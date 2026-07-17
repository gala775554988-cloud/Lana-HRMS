import { NextRequest, NextResponse } from "next/server";
import { fullResyncFromOdoo, requireOdooIntegrationAccess, hasInternalSyncToken } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function isAuthorizedCronOrTokenRequest(request: NextRequest) {
  if (hasInternalSyncToken(request)) return true;
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return false;
}

/**
 * Execute comprehensive Full Resync Protocol from Odoo:
 * - Formats codes with `00` prefix (`formatEmployeeCode`).
 * - Maps school (`x_studio_school_name`) to Hospital and Branch.
 * - Maps analytic accounts, departments, managers, and documents.
 * - Supports `smart_upsert` (default, non-destructive) or optional `wipeAndSync`.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronOrTokenRequest(request)) {
      await requireOdooIntegrationAccess("manage", request);
    }
    const wipeAndSync = request.nextUrl.searchParams.get("wipeAndSync") === "true";
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;

    const result = await fullResyncFromOdoo({ wipeAndSync, connectionId });
    return NextResponse.json({
      success: true,
      message: wipeAndSync
        ? `تمت إعادة الضبط وسحب (${result.count}) موظف بنجاح بالتنسيق الموحد`
        : `تمت المزامنة الذكية الشاملة لـ (${result.count}) موظف بنجاح دون مسح السجلات السابقة`,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronOrTokenRequest(request)) {
      await requireOdooIntegrationAccess("manage", request);
    }
    const body = await request.json().catch(() => ({}));
    const wipeAndSync = Boolean(body.wipeAndSync);
    const connectionId = body.connectionId || undefined;

    const result = await fullResyncFromOdoo({ wipeAndSync, connectionId });
    return NextResponse.json({
      success: true,
      message: wipeAndSync
        ? `تمت إعادة الضبط وسحب (${result.count}) موظف بنجاح بالتنسيق الموحد`
        : `تمت المزامنة الذكية الشاملة لـ (${result.count}) موظف بنجاح دون مسح السجلات السابقة`,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}
