import { NextRequest, NextResponse } from "next/server";
import { fullResyncFromOdoo, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

/**
 * Execute comprehensive Full Resync Protocol from Odoo:
 * - Formats codes with `00` prefix (`formatEmployeeCode`).
 * - Maps school (`x_studio_school_name`) to Hospital and Branch.
 * - Maps analytic accounts, departments, managers, and documents.
 * - Supports `smart_upsert` (default, non-destructive) or optional `wipeAndSync`.
 */
export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
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
