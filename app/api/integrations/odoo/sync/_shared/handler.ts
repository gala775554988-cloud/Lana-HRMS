import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import type { SyncEntity, SyncOptions } from "@/lib/integrations/odoo/types";

export function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function runOdooEntitySync(request: NextRequest, entity: SyncEntity) {
  try {
    await requireOdooIntegrationAccess("manage", request);
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || request.headers.get("x-tenant-id") || undefined;
    const service = await OdooSyncService.forConnection(body.connectionId);
    const options: SyncOptions = {
      ...body,
      entity,
      tenantId,
      incremental: body.incremental ?? true,
      direction: body.direction || "ODOO_TO_LANA"
    };
    const result = await service.sync(options);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
