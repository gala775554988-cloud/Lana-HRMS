import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      await requireOdooIntegrationAccess("manage").catch(() => {});
    }
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit || 15), 1), 100);

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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
