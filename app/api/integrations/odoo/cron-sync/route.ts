import { retryPendingRequests, syncOdooRequests } from "@/lib/integrations/odoo/requests/service";
import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, hasInternalSyncToken } from "@/lib/integrations/odoo/sync";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

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
    const result = await service.sync({ entity: "all", direction: "ODOO_TO_LANA" });
    if (result.errors.length) {
      await writeAuditLog({ action: "ODOO_CRON_SYNC_BLOCKED", entity: "odoo", metadata: { errors: result.errors.slice(0, 100), pulled: result.pulled, created: result.created, updated: result.updated } }).catch(() => undefined);
      return NextResponse.json({ success: false, blocked: true, message: "Odoo sync completed with validation or persistence errors; review logs before retrying", result }, { status: 422 });
    }
    await writeAuditLog({ action: "ODOO_CRON_SYNC", entity: "odoo", metadata: { entity: result.entity, pulled: result.pulled, pushed: result.pushed, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length, pendingDetailJobs } }).catch(() => undefined);
    return NextResponse.json({ success: true, result, requestRetries, requestSync, pendingDetailJobs });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
