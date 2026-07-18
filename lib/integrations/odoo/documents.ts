import { prisma } from "@/lib/prisma";
import { uploadFileToSupabase } from "@/lib/storage/supabase";
import type { OdooClient } from "./client";
import type { OdooRecord } from "./types";

const BANK_NAME_PATTERN = /(bank_letter|iban_cert|swift_cert|routing_letter|account_letter)/i;

type OdooAttachment = OdooRecord & {
  id: number;
  name?: string;
  mimetype?: string;
  file_size?: number;
};

export type DocumentSyncResult = {
  imported: number;
  skipped: number;
  errors: Array<{ attachmentId?: number; attachmentName?: string; message: string }>;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-\u0600-\u06FF\s]/g, "_").trim().slice(0, 180) || "document.pdf";
}

/**
 * Pulls every attachment Odoo has linked to an employee record (res_model=hr.employee or hr.contract) and
 * mirrors it into EmployeeDocument. If Supabase storage is unconfigured or returns null, gracefully falls back
 * to saving the document via data URI or direct storage so the employee's documents tab always displays every
 * Odoo file (residency cards, training certificates, ID copies, etc.).
 */
export async function syncEmployeeDocuments(client: OdooClient, odooEmployeeId: number, localEmployeeId: string): Promise<DocumentSyncResult> {
  const result: DocumentSyncResult = { imported: 0, skipped: 0, errors: [] };
  if (!odooEmployeeId || odooEmployeeId <= 0 || !localEmployeeId) return result;

  // Search ir.attachment linked to hr.employee
  const attachments = await client.search_read<OdooAttachment>(
    "ir.attachment",
    [["res_model", "in", ["hr.employee", "hr.contract"]], ["res_id", "=", odooEmployeeId]],
    ["id", "name", "mimetype", "file_size", "create_date"],
    { limit: 200 }
  ).catch(() => []);

  if (!attachments || attachments.length === 0) return result;

  const candidateIds = attachments
    .filter((a) => !BANK_NAME_PATTERN.test(String(a.name ?? "")))
    .map((a) => a.id);
  if (candidateIds.length === 0) return result;

  const alreadyImported = await prisma.employeeDocument.findMany({
    where: { odooAttachmentId: { in: candidateIds } },
    select: { odooAttachmentId: true },
  }).catch(() => []);
  const importedIds = new Set(alreadyImported.map((d) => d.odooAttachmentId));

  for (const attachment of attachments) {
    if (BANK_NAME_PATTERN.test(String(attachment.name ?? ""))) {
      result.skipped += 1;
      continue;
    }
    if (importedIds.has(attachment.id)) {
      result.skipped += 1;
      continue;
    }
    try {
      const [full] = await client.read<OdooRecord & { datas?: string }>("ir.attachment", [attachment.id], ["datas"]).catch(() => [null]);
      if (!full?.datas) { result.skipped += 1; continue; }
      
      const buffer = Buffer.from(full.datas, "base64");
      const fileName = sanitizeFileName(attachment.name || `odoo-attachment-${attachment.id}`);
      const mimeType = attachment.mimetype || "application/octet-stream";
      const objectPath = `odoo-documents/${localEmployeeId}/${attachment.id}-${fileName}`;
      
      // Attempt upload to external storage (Supabase / S3), fallback to data URI if offline/unconfigured
      let fileUrl = await uploadFileToSupabase(buffer, objectPath, mimeType);
      if (!fileUrl) {
        // Fallback: if buffer is under 10MB, embed directly as data URI so document is accessible right inside the UI
        if (buffer.byteLength < 10_000_000) {
          fileUrl = `data:${mimeType};base64,${full.datas}`;
        } else {
          fileUrl = `/api/employee/${localEmployeeId}/documents/download/${attachment.id}`;
        }
      }

      await prisma.employeeDocument.create({
        data: {
          employeeId: localEmployeeId,
          type: "ODOO_ATTACHMENT",
          name: attachment.name || fileName,
          fileUrl,
          fileName,
          mimeType,
          sizeBytes: attachment.file_size ?? buffer.byteLength,
          status: "VERIFIED",
          source: "ODOO",
          odooAttachmentId: attachment.id,
        },
      });
      result.imported += 1;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[OdooAttachmentSync] Error processing file '${attachment.name || "unknown"}' (ID #${attachment.id}): ${errMsg}`);
      result.errors.push({ attachmentId: attachment.id, attachmentName: attachment.name || "unknown", message: errMsg });
    }
  }

  return result;
}
