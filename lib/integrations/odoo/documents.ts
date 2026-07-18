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
  res_id?: number | unknown;
  res_model?: string;
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
 * Bulk High-Speed Document Sync Protocol (`bulkSyncAllOdooDocuments`).
 * Fetches attachments directly from Odoo (`ir.attachment`) in one single bulk search_read
 * query without looping 1,620 times over individual employee IDs.
 */
export async function bulkSyncAllOdooDocuments(client: OdooClient, limit = 2000, offset = 0): Promise<DocumentSyncResult> {
  const result: DocumentSyncResult = { imported: 0, skipped: 0, errors: [] };

  const attachments = await client.search_read<OdooAttachment>(
    "ir.attachment",
    [["res_model", "in", ["hr.employee", "hr.contract"]]],
    ["id", "name", "mimetype", "file_size", "create_date", "res_id", "res_model"],
    { limit, offset, order: "id desc" }
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

  // Build employee lookup maps for quick association
  const employees = await prisma.employee.findMany({
    where: { odooId: { not: null } },
    select: { id: true, odooId: true }
  }).catch(() => []);
  const empByOdooId = new Map<number, string>();
  for (const e of employees) {
    if (e.odooId) empByOdooId.set(e.odooId, e.id);
  }

  // Pre-resolve contracts if any attachment is linked to hr.contract
  const contractResIds = attachments.filter((a) => a.res_model === "hr.contract" && typeof a.res_id === "number").map((a) => a.res_id as number);
  const contractToEmpId = new Map<number, string>();
  if (contractResIds.length > 0) {
    try {
      const contracts = await client.search_read(
        "hr.contract",
        [["id", "in", contractResIds]],
        ["id", "employee_id"],
        { limit: contractResIds.length }
      ).catch(() => []);
      for (const c of contracts as any[]) {
        const empOdooId = Array.isArray(c.employee_id) ? Number(c.employee_id[0]) : Number(c.employee_id);
        const localEmpId = empByOdooId.get(empOdooId);
        if (localEmpId) contractToEmpId.set(Number(c.id), localEmpId);
      }
    } catch {}
  }

  // Process new unimported attachments (up to 200 per run to prevent serverless timeout)
  let processedNew = 0;
  for (const attachment of attachments) {
    if (BANK_NAME_PATTERN.test(String(attachment.name ?? ""))) {
      result.skipped += 1;
      continue;
    }
    if (importedIds.has(attachment.id)) {
      result.skipped += 1;
      continue;
    }
    if (processedNew >= 300) {
      continue;
    }

    const resIdNum = typeof attachment.res_id === "number" ? attachment.res_id : (Array.isArray(attachment.res_id) ? Number(attachment.res_id[0]) : 0);
    let localEmployeeId: string | undefined = undefined;
    if (attachment.res_model === "hr.employee") {
      localEmployeeId = empByOdooId.get(resIdNum);
    } else if (attachment.res_model === "hr.contract") {
      localEmployeeId = contractToEmpId.get(resIdNum);
    }
    if (!localEmployeeId) {
      result.skipped += 1;
      continue;
    }

    try {
      processedNew++;
      const [full] = await client.read<OdooRecord & { datas?: string }>("ir.attachment", [attachment.id], ["datas"]).catch(() => [null]);
      if (!full?.datas) { result.skipped += 1; continue; }
      
      const buffer = Buffer.from(full.datas, "base64");
      const fileName = sanitizeFileName(attachment.name || `odoo-attachment-${attachment.id}`);
      const mimeType = attachment.mimetype || "application/octet-stream";
      const objectPath = `odoo-documents/${localEmployeeId}/${attachment.id}-${fileName}`;
      
      let fileUrl = await uploadFileToSupabase(buffer, objectPath, mimeType);
      if (!fileUrl) {
        // Prevent Postgres 512MB storage quota overflow: only embed files < 400KB as direct data URI
        if (buffer.byteLength < 400_000) {
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
      result.errors.push({ attachmentId: attachment.id, attachmentName: attachment.name || "unknown", message: errMsg });
    }
  }

  return result;
}

/**
 * Pulls every attachment Odoo has linked to an employee record (res_model=hr.employee or hr.contract) and
 * mirrors it into EmployeeDocument.
 */
export async function syncEmployeeDocuments(client: OdooClient, odooEmployeeId: number, localEmployeeId: string): Promise<DocumentSyncResult> {
  const result: DocumentSyncResult = { imported: 0, skipped: 0, errors: [] };
  if (!odooEmployeeId || odooEmployeeId <= 0 || !localEmployeeId) return result;

  const attachments = await client.search_read<OdooAttachment>(
    "ir.attachment",
    [["res_id", "=", odooEmployeeId]],
    ["id", "name", "mimetype", "file_size", "create_date", "res_model"],
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
      
      let fileUrl = await uploadFileToSupabase(buffer, objectPath, mimeType);
      if (!fileUrl) {
        if (buffer.byteLength < 400_000) {
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
      result.errors.push({ attachmentId: attachment.id, attachmentName: attachment.name || "unknown", message: errMsg });
    }
  }

  return result;
}
