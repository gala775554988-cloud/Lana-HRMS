import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage").catch(() => {});
    const body = await request.json().catch(() => ({}));
    const odooId = Number(body.odooId);
    const employeeId = body.employeeId ? String(body.employeeId) : undefined;
    const connectionId = body.connectionId ? String(body.connectionId) : undefined;

    if (!odooId || odooId <= 0) {
      return NextResponse.json({ success: false, message: "Valid odooId is required for lazy loading details" }, { status: 400 });
    }

    const service = await OdooSyncService.forConnection(connectionId);
    const result = await service.syncSingleEmployeeDetails(odooId, employeeId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
