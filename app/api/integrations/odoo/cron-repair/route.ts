import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retryMigrationRecord } from "@/lib/integrations/odoo/migration/worker";
import { hasInternalSyncToken } from "@/lib/integrations/odoo/sync";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!hasInternalSyncToken(request) && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  // Reuse the audited, leased, source-identity-checked migration worker.
  // Exclude running jobs, cap retries to avoid hammering permanently bad records.
  const failures = await prisma.odooMigrationError.findMany({
    where: {
      status: "OPEN", attempts: { lt: 5 },
      job: { status: { in: ["FAILED", "PAUSED", "COMPLETED", "COMPLETED_WITH_ERRORS"] } }
    },
    orderBy: [{ attempts: "asc" }, { updatedAt: "asc" }],
    take: 5,
    select: { id: true, jobId: true, entity: true, externalId: true }
  });
  const outcomes: Array<{ id: string; resolved: boolean; reason?: string }> = [];
  for (const failure of failures) {
    try {
      await retryMigrationRecord(failure.jobId, failure.id);
      const verified = await prisma.odooMigrationError.findUnique({ where: { id: failure.id }, select: { status: true } });
      if (verified?.status !== "RESOLVED") throw new Error("Migration resolution could not be verified");
      outcomes.push({ id: failure.id, resolved: true });
    } catch (error) {
      outcomes.push({ id: failure.id, resolved: false, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const remaining = await prisma.odooMigrationError.count({ where: { status: "OPEN" } });
  await writeAuditLog({
    action: "ODOO_MIGRATION_AUTO_REPAIR",
    entity: "odooMigrationError",
    metadata: { attempted: outcomes.length, resolved: outcomes.filter(row => row.resolved).length, remaining }
  }).catch(() => undefined);
  return NextResponse.json({ success: outcomes.every(row => row.resolved), attempted: outcomes.length,
    resolved: outcomes.filter(row => row.resolved).length, remaining, outcomes });
}
