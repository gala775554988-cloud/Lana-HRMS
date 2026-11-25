import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });

  const [migrationOpen, migrationFailed, detailPending, detailFailed, queuePending, lastSyncs, lastFailures] =
    await Promise.all([
      prisma.odooMigrationError.count({ where: { status: "OPEN" } }),
      prisma.odooMigrationJob.count({ where: { status: { in: ["FAILED", "COMPLETED_WITH_ERRORS"] } } }),
      prisma.integrationJob.count({ where: { type: "ODOO_EMPLOYEE_DETAIL_SYNC", status: { in: ["PENDING", "RETRY"] } } }),
      prisma.integrationJob.count({ where: { type: "ODOO_EMPLOYEE_DETAIL_SYNC", status: "FAILED" } }),
      prisma.integrationQueue.count({ where: { status: { in: ["PENDING", "RETRY"] } } }),
      prisma.syncHistory.findMany({
        orderBy: { startedAt: "desc" }, take: 15,
        select: { id: true, entity: true, status: true, startedAt: true, finishedAt: true,
          pulled: true, pushed: true, createdCount: true, updatedCount: true, error: true }
      }),
      prisma.integrationLog.findMany({
        where: { level: { in: ["ERROR", "WARN", "WARNING"] } },
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, action: true, level: true, message: true, createdAt: true }
      })
    ]);
  return NextResponse.json({
    success: true, capturedAt: new Date().toISOString(),
    counters: { migrationOpen, migrationFailed, detailPending, detailFailed, queuePending },
    lastSyncs, lastFailures
  }, { headers: { "Cache-Control": "private, no-store" } });
}
