import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OdooClient } from "@/lib/integrations/odoo/client";
import { bulkSyncAllOdooDocuments } from "@/lib/integrations/odoo/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

/**
 * Dedicated high-speed Odoo Document Sync Endpoint (`/api/internal/sync-odoo-documents`).
 * Connects directly to Odoo API (`ir.attachment`) in one single bulk search_read query
 * on Vercel to pull residency cards (`هوية مقيم`), training certificates (`شهادة تدريب 39.pdf`),
 * and ID copies (`1605.pdf`) across all employees inside ~3-4 seconds.
 */
export async function GET(request: NextRequest) {
  return executeDocumentSync(request);
}

export async function POST(request: NextRequest) {
  return executeDocumentSync(request);
}

async function executeDocumentSync(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 3000;

    const client = OdooClient.fromEnv();
    await client.connect();

    const res = await bulkSyncAllOdooDocuments(client, limit);

    return NextResponse.json({
      success: true,
      message: `تم سحب وحفظ المرفقات والمستندات بنجاح (${res.imported} مستند جديد مضاف من أودو، ${res.skipped} متواجد مسبقاً)`,
      imported: res.imported,
      skipped: res.skipped,
      errorsCount: res.errors.length,
      errors: res.errors.slice(0, 50)
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: `تعذر الاتصال بأودو من الخادم: ${msg}`,
      error: msg
    }, { status: 500 });
  }
}
