import { prisma } from "@/lib/prisma";
import { uploadFileToSupabase } from "@/lib/storage/supabase";
import type { OdooClient } from "./client";
import type { OdooRecord } from "./types";

const BANK_NAME_PATTERN = /(bank|iban|swift|bic|routing|acc[_-]?number|account[_-]?number)/i;

type OdooAttachment = OdooRecord & {
  id: number;
  name?: string;
  mimetype?: string;
  file_size?: number;
};

export type DocumentSyncResult = {
  imported: number;
  skipped: number;
  errors: Array<{ attachmentId?: number; message: string }>;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

/**
 * Pulls every attachment Odoo has linked to an employee record (res_model=hr.employee) and
 * mirrors it into EmployeeDocument, skipping anything already imported and anything that looks
 * like banking/payment paperwork (bank letters, IBAN certificates, etc.).
 */
export async function syncEmployeeDocuments(client: OdooClient, odooEmployeeId: number, localEmployeeId: string): Promise<DocumentSyncResult> {
  const result: DocumentSyncResult = { imported: 0, skipped: 0, errors: [] };

  const attachments = await client.search_read<OdooAttachment>(
    "ir.attachment",
    [["res_model", "=", "hr.employee"], ["res_id", "=", odooEmployeeId]],
    ["id", "name", "mimetype", "file_size", "create_date"],
    { limit: 200 }
  );
  if (!attachments || attachments.length === 0) return result;

  const candidateIds = attachments
    .filter((a) => !BANK_NAME_PATTERN.test(String(a.name ?? "")))
    .map((a) => a.id);
  if (candidateIds.length === 0) return result;

  const alreadyImported = await prisma.employeeDocument.findMany({
    where: { odooAttachmentId: { in: candidateIds } },
    select: { odooAttachmentId: true },
  });
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
      const [full] = await client.read<OdooRecord & { datas?: string }>("ir.attachment", [attachment.id], ["datas"]);
      if (!full?.datas) { result.skipped += 1; continue; }
      const buffer = Buffer.from(full.datas, "base64");
      const fileName = sanitizeFileName(attachment.name || `odoo-attachment-${attachment.id}`);
      const mimeType = attachment.mimetype || "application/octet-stream";
      const objectPath = `odoo-documents/${localEmployeeId}/${attachment.id}-${fileName}`;
      const fileUrl = await uploadFileToSupabase(buffer, objectPath, mimeType);
      if (!fileUrl) { result.errors.push({ attachmentId: attachment.id, message: "Storage upload failed (Supabase not configured or request failed)" }); continue; }

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
      result.errors.push({ attachmentId: attachment.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
