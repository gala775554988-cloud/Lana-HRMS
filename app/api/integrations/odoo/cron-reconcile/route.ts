import { NextRequest, NextResponse } from "next/server";
import { fullResyncFromOdoo, hasInternalSyncToken } from "@/lib/integrations/odoo/sync";
import { reconcileEmployeeNumbersAndIds } from "@/lib/integrations/odoo/employee-number-reconcile";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!hasInternalSyncToken(request) && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
  try {
    // Full reconciliation runs daily, not on every five-minute incremental sync.
    // Never wipe historical employees or payroll records.
    const resyncResult = await fullResyncFromOdoo({ wipeAndSync: false, connectionId });
    const numbersReconcile = await reconcileEmployeeNumbersAndIds({ connectionId, createMissing: true, timeBudgetMs: 50_000 });
    await writeAuditLog({ action: "ODOO_DAILY_RECONCILIATION", entity: "odoo", metadata: { resyncResult, numbersReconcile } }).catch(() => undefined);
    return NextResponse.json({ success: true, resyncResult, numbersReconcile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeAuditLog({ action: "ODOO_DAILY_RECONCILIATION_FAILED", entity: "odoo", metadata: { message } }).catch(() => undefined);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
