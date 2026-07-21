import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, fullResyncFromOdoo, hasInternalSyncToken } from "@/lib/integrations/odoo/sync";
import { reconcileEmployeeNumbersAndIds } from "@/lib/integrations/odoo/employee-number-reconcile";
import { writeAuditLog } from "@/lib/audit";

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
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
    const resyncResult = await fullResyncFromOdoo({ wipeAndSync: false, connectionId }).catch((err) => ({ error: err.message || String(err) }));
    const service = await OdooSyncService.forConnection(connectionId);
    const result = await service.sync({ entity: "all", direction: "BIDIRECTIONAL" });
    // Daily guaranteed reconciliation: الأرقام الوظيفية والـ odooId تبقى مطابقة
    // لأودو 100% كل يوم دون أي تدخل يدوي. يصلح أي انجراف ناتج عن تعديلات
    // إدارية مباشرة أو مزامنة ناقصة سابقة.
    const numbersReconcile = await reconcileEmployeeNumbersAndIds({ connectionId, createMissing: true, timeBudgetMs: 50_000 })
      .catch((err) => ({ error: err instanceof Error ? err.message : String(err) }));
    await writeAuditLog({ action: "ODOO_CRON_SYNC", entity: "odoo", metadata: { resyncResult, entity: result.entity, pulled: result.pulled, pushed: result.pushed, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length, numbersReconcile } }).catch(() => undefined);
    return NextResponse.json({ success: true, resyncResult, result, numbersReconcile });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
