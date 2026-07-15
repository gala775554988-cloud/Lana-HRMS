import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 180;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    // Must reject on failure, not swallow it -- a caught-and-ignored auth
    // check here means this route (triggered client-side to lazy-load one
    // employee's Odoo details) runs for anyone, logged in or not.
    await requireOdooIntegrationAccess("manage");
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
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
