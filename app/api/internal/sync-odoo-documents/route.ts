import { NextRequest, NextResponse } from "next/server";
import { OdooClient } from "@/lib/integrations/odoo/client";
import { bulkSyncAllOdooDocuments } from "@/lib/integrations/odoo/documents";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

/**
 * Dedicated high-speed Odoo Document Sync Endpoint (`/api/internal/sync-odoo-documents`).
 * Connects directly to Odoo API (`ir.attachment`) in one single bulk search_read query
 * to pull residency cards, training certificates, and ID copies across all employees.
 * Supports pagination (`?limit=200&offset=0`) for automatic background batch extraction.
 * Same auth boundary as the other Odoo integration routes: an authenticated
 * SUPER_ADMIN/HR_MANAGER session, or the internal sync token for server-to-server
 * callers (see requireOdooIntegrationAccess) -- middleware whitelists this path from
 * the cookie-redirect gate specifically so the internal-token path works, not to skip
 * auth altogether.
 */
export async function GET(request: NextRequest) {
  return executeDocumentSync(request);
}

export async function POST(request: NextRequest) {
  return executeDocumentSync(request);
}

async function executeDocumentSync(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage", request);
    const limitParam = request.nextUrl.searchParams.get("limit");
    const offsetParam = request.nextUrl.searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : 3000;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const client = OdooClient.fromEnv();
    await client.connect();

    const res = await bulkSyncAllOdooDocuments(client, limit, offset);

    return NextResponse.json({
      success: true,
      message: `تم سحب وحفظ المرفقات والمستندات بنجاح (${res.imported} مستند جديد مضاف من أودو، ${res.skipped} متواجد مسبقاً)`,
      imported: res.imported,
      skipped: res.skipped,
      offset,
      errorsCount: res.errors.length,
      errors: res.errors.slice(0, 50)
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: `تعذر الاتصال بأودو من الخادم: ${msg}`,
      error: msg
    }, { status: statusFor(error) });
  }
}
