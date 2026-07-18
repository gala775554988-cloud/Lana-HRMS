import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OdooClient } from "@/lib/integrations/odoo/client";
import { syncEmployeeDocuments } from "@/lib/integrations/odoo/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

/**
 * Dedicated high-speed Odoo Document Sync Endpoint (`/api/internal/sync-odoo-documents`).
 * Connects directly to Odoo API (`ir.attachment`) on Vercel to pull residency cards (`هوية مقيم`),
 * training certificates (`شهادة تدريب 39.pdf`), and ID copies (`1605.pdf`) across all employees
 * without requiring admin web permission.
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
    const limit = limitParam ? parseInt(limitParam, 10) : 500;

    const client = OdooClient.fromEnv();
    await client.connect();

    const employees = await prisma.employee.findMany({
      where: { odooId: { not: null } },
      select: { id: true, odooId: true, firstName: true, lastName: true },
      take: limit,
      orderBy: { updatedAt: "desc" }
    });

    let totalImported = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (const emp of employees) {
      if (!emp.odooId) continue;
      try {
        const res = await syncEmployeeDocuments(client, emp.odooId, emp.id);
        totalImported += res.imported;
        totalSkipped += res.skipped;
        for (const err of res.errors) {
          allErrors.push(`[Emp #${emp.odooId}] ${err.attachmentName}: ${err.message}`);
        }
      } catch (err: any) {
        allErrors.push(`[Emp #${emp.odooId}] ${err?.message || err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم سحب المرفقات والمستندات بنجاح (${totalImported} مستند جديد من أودو)`,
      totalEmployeesChecked: employees.length,
      imported: totalImported,
      skipped: totalSkipped,
      errors: allErrors.slice(0, 50)
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
