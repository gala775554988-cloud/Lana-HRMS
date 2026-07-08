import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
    const service = await OdooSyncService.forConnection(connectionId);
    return NextResponse.json(await service.testConnection());
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const body = await request.json().catch(() => ({}));
    const service = await OdooSyncService.forConnection(body.connectionId);
    return NextResponse.json(await service.testConnection());
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
