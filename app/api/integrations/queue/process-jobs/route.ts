import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function processJobs(request: NextRequest, limit: number) {
  try {
    // Must reject on failure, not swallow it -- a caught-and-ignored auth
    // check here left this route fully open whenever CRON_SECRET didn't
    // match (including when it's simply unset).
    if (!isAuthorizedCronRequest(request)) {
      await requireOdooIntegrationAccess("manage");
    }

    const jobs = await prisma.integrationJob.findMany({
      where: {
        type: "ODOO_EMPLOYEE_DETAIL_SYNC",
        status: { in: ["PENDING", "RETRY"] },
        OR: [
          { runAt: null },
          { runAt: { lte: new Date() } }
        ]
      },
      orderBy: [
        { attempts: "asc" },
        { createdAt: "asc" }
      ],
      take: limit
    });

    const results = [];
    for (const job of jobs) {
      await prisma.integrationJob.update({
        where: { id: job.id },
        data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } }
      });

      try {
        const payload = job.payload as any || {};
        const odooId = Number(payload.odooId);
        const employeeId = payload.employeeId ? String(payload.employeeId) : undefined;
        const connectionId = job.connectionId || undefined;

        if (!odooId) {
          throw new Error("Missing odooId in job payload");
        }

        const service = await OdooSyncService.forConnection(connectionId);
        const detailResult = await service.syncSingleEmployeeDetails(odooId, employeeId);

        if (!detailResult.success) {
          throw new Error(detailResult.reason || "Detail sync failed");
        }

        const updated = await prisma.integrationJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            finishedAt: new Date(),
            result: detailResult as any,
            lastError: null
          }
        });
        results.push({ jobId: job.id, odooId, status: "COMPLETED" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = job.attempts + 1;
        const dead = attempts >= job.maxAttempts;
        await prisma.integrationJob.update({
          where: { id: job.id },
          data: {
            status: dead ? "FAILED" : "RETRY",
            finishedAt: dead ? new Date() : null,
            runAt: dead ? null : new Date(Date.now() + Math.min(60_000 * attempts, 300_000)),
            lastError: message
          }
        });
        results.push({ jobId: job.id, status: dead ? "FAILED" : "RETRY", error: message });
      }
    }

    return NextResponse.json({ success: true, processedCount: results.length, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}

// Vercel Cron always sends GET (see cron-sync/route.ts) -- this route
// previously only exported POST, so even with a cron entry configured it
// would 405 and never run, leaving every queued
// ODOO_EMPLOYEE_DETAIL_SYNC job PENDING forever unless someone happened to
// open that specific employee's profile page (which triggers the same
// sync directly, bypassing the queue).
export async function GET(request: NextRequest) {
  return processJobs(request, 50);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit || 15), 1), 100);
  return processJobs(request, limit);
}
