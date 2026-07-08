import { NextRequest, NextResponse } from "next/server";
import { OdooAttendanceService } from "@/lib/integrations/odoo/services/attendance";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import type { SyncOptions } from "@/lib/integrations/odoo/types";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("read");
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const service = new OdooAttendanceService(await OdooSyncService.forConnection(connectionId));
    return NextResponse.json({ success: true, data: await service.list(limit) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const body = await request.json().catch(() => ({}));
    const service = new OdooAttendanceService(await OdooSyncService.forConnection(body.connectionId));
    return NextResponse.json({ success: true, result: await service.sync(body as SyncOptions) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
