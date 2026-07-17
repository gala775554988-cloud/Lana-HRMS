import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOdooIntegrationAccess, createOdooClientFromConnection } from "@/lib/integrations/odoo/sync";
import { syncEmployeeDocuments, type DocumentSyncResult } from "@/lib/integrations/odoo/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

/**
 * Execute Binary Attachment & Document Synchronization from Odoo (`ir.attachment` where `res_model = hr.employee`):
 * - Queries Odoo for files linked to each employee (`search_read` + binary `read`).
 * - Uploads base64 content to storage bucket and retrieves public fileUrl.
 * - Stores metadata and public URLs inside `EmployeeDocument` in Neon PostgreSQL.
 * - Logs exact filenames (`attachmentName`) and error reasons on any individual failure.
 */
export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage", request);
    const body = await request.json().catch(() => ({}));
    const connectionId = body.connectionId || undefined;
    const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds : undefined;

    const { client } = await createOdooClientFromConnection(connectionId);
    await client.connect();

    const whereClause: Record<string, unknown> = { status: "ACTIVE", odooId: { not: null } };
    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds };
    }

    const targetEmployees = await prisma.employee.findMany({
      where: whereClause,
      select: { id: true, employeeNumber: true, firstName: true, lastName: true, odooId: true }
    });

    const summary = {
      totalEmployeesChecked: targetEmployees.length,
      totalImported: 0,
      totalSkipped: 0,
      failedFiles: [] as Array<{ employeeId: string; employeeName: string; attachmentId?: number; attachmentName?: string; message: string }>
    };

    console.log(`[OdooAttachmentSync] Starting attachment sync across ${targetEmployees.length} employees...`);

    for (const emp of targetEmployees) {
      if (!emp.odooId) continue;
      const empFullName = `${emp.firstName} ${emp.lastName}`.trim();
      try {
        const res: DocumentSyncResult = await syncEmployeeDocuments(client, emp.odooId, emp.id);
        summary.totalImported += res.imported;
        summary.totalSkipped += res.skipped;
        if (res.errors.length > 0) {
          for (const err of res.errors) {
            summary.failedFiles.push({
              employeeId: emp.id,
              employeeName: empFullName,
              attachmentId: err.attachmentId,
              attachmentName: err.attachmentName,
              message: err.message
            });
          }
        }
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[OdooAttachmentSync] Error processing employee ${empFullName} (ID #${emp.id}): ${msg}`);
        summary.failedFiles.push({
          employeeId: emp.id,
          employeeName: empFullName,
          message: msg
        });
      }
    }

    console.log(`[OdooAttachmentSync] Completed. Imported: ${summary.totalImported}, Skipped: ${summary.totalSkipped}, Failed Files: ${summary.failedFiles.length}`);

    return NextResponse.json({
      success: true,
      message: `تمت مزامنة المرفقات بنجاح: تم استيراد (${summary.totalImported}) ملف وتخزينه في Neon، واستبعاد (${summary.totalSkipped}) ملف مكرر/بنكي، مع تسجيل (${summary.failedFiles.length}) إخفاق.`,
      summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
