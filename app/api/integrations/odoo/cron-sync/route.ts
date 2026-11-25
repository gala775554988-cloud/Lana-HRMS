import { retryPendingRequests, syncOdooRequests } from "@/lib/integrations/odoo/requests/service";
import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, hasInternalSyncToken } from "@/lib/integrations/odoo/sync";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { SyncEntity, SyncResult } from "@/lib/integrations/odoo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorizedCronRequest(request: NextRequest) {
  if (hasInternalSyncToken(request)) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Never silently discard failed request reconciliation.
    const requestRetries = await retryPendingRequests(2);
    const requestSync = await syncOdooRequests(undefined, 1);
    const pendingDetailJobs = await prisma.integrationJob.count({ where: { type: "ODOO_EMPLOYEE_DETAIL_SYNC", status: { in: ["PENDING", "RETRY"] } } });
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
    const service = await OdooSyncService.forConnection(connectionId);
    // Incremental, read-only from Odoo. Payroll snapshots are deliberately
    // excluded from the five-minute loop (full payslip history is expensive).
    const entities: SyncEntity[] = ["companies", "departments", "jobs", "employees", "contracts", "attendance", "leave"];
    const results: SyncResult[] = [];
    for (const entity of entities) {
      results.push(await service.sync({ entity, direction: "ODOO_TO_LANA", incremental: true, batchSize: 100, mode: "ID_FIRST" }));
    }
    const result = {
      entity: "incremental",
      pulled: results.reduce((sum, row) => sum + row.pulled, 0),
      pushed: results.reduce((sum, row) => sum + row.pushed, 0),
      created: results.reduce((sum, row) => sum + row.created, 0),
      updated: results.reduce((sum, row) => sum + row.updated, 0),
      skipped: results.reduce((sum, row) => sum + row.skipped, 0),
      errors: results.flatMap(row => row.errors)
    };
    if (result.errors.length) {
      await writeAuditLog({ action: "ODOO_CRON_SYNC_BLOCKED", entity: "odoo", metadata: {
        errors: result.errors.slice(0, 100), pulled: result.pulled, created: result.created, updated: result.updated
      } }).catch(() => undefined);
      return NextResponse.json({ success: false, blocked: true,
        message: "Incremental Odoo sync completed with errors; see the sync history", result, results },
        { status: 422 });
    }
    await writeAuditLog({ action: "ODOO_CRON_SYNC", entity: "odoo", metadata: { entity: result.entity, pulled: result.pulled, pushed: result.pushed, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length, pendingDetailJobs } }).catch(() => undefined);
    return NextResponse.json({ success: true, result, results, requestRetries, requestSync, pendingDetailJobs });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
