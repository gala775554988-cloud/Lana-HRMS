import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// TEMPORARY PUBLIC SYNC ENDPOINT - REMOVE AFTER USE
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const service = await OdooSyncService.forConnection(body.connectionId);
    const result = await service.sync({
      entity: "employees",
      direction: "ODOO_TO_LANA",
      incremental: body.incremental ?? false,
      batchSize: body.batchSize ?? 200,
      limit: body.limit ?? 200,
      ...body,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const service = await OdooSyncService.forConnection();
    const result = await service.sync({
      entity: "employees",
      direction: "ODOO_TO_LANA",
      incremental: false,
      batchSize: 200,
      limit: 200,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
