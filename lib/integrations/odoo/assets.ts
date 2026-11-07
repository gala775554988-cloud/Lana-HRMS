import type { AssetStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { OdooJsonRpcClient } from "@/lib/integrations/odoo";

type Field = { type: string; relation?: string };
type Equipment = { id: number; name: unknown; serial_no?: unknown; category_id?: unknown; [key: string]: unknown };

function relationId(value: unknown) {
  return Array.isArray(value) && Number.isSafeInteger(value[0]) && value[0] > 0 ? Number(value[0]) : null;
}

export async function importOdooAssets(client: OdooJsonRpcClient, source: string, employeeField?: string) {
  const model = "maintenance.equipment";
  const fields = await client.execute<Record<string, Field>>(model, "fields_get", [], { attributes: ["type", "relation"] });
  const relations = Object.keys(fields).filter(key => fields[key].type === "many2one" && fields[key].relation === "hr.employee");
  const assigneeField = employeeField || (relations.includes("employee_id") ? "employee_id" : relations.length === 1 ? relations[0] : null);
  if (!assigneeField || !relations.includes(assigneeField)) throw new Error("تعذر تحديد حقل الموظف المسؤول عن العهدة في أودو");
  const sourceHash = createHash("sha256").update(source).digest("hex").slice(0, 20);
  const columns = ["id", "name", assigneeField, ...["serial_no", "category_id"].filter(key => fields[key])];
  let lastId = 0;
  let createdCount = 0;
  let updatedCount = 0;

  for (;;) {
    const rows = await client.searchRead<Equipment>(model, [["id", ">", lastId]], columns, { order: "id asc", limit: 100 });
    if (!rows.length) break;
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id <= lastId || typeof row.name !== "string" || !row.name.trim()) throw new Error("سجل أصل غير صالح في أودو");
      lastId = row.id;
      const remoteEmployeeId = relationId(row[assigneeField]);
      if (row[assigneeField] !== false && row[assigneeField] !== null && !remoteEmployeeId) throw new Error(`تعيين العهدة غير صالح للأصل ${row.id}`);
      const assetTag = `ODOO-${sourceHash}-${row.id}`;
      const serialNumber = typeof row.serial_no === "string" && row.serial_no.trim() ? row.serial_no.trim() : null;
      const category = Array.isArray(row.category_id) && typeof row.category_id[1] === "string" ? row.category_id[1] : "معدات";
      const created = await prisma.$transaction(async tx => {
        if (remoteEmployeeId) {
          const binding = await tx.appSetting.findUnique({ where: { key: "odoo.migration.employeeSource" }, select: { value: true } });
          if (binding?.value !== source) throw new Error("مصدر الموظفين غير مطابق لاتصال العهد في أودو");
        }
        const employee = remoteEmployeeId ? await tx.employee.findUnique({ where: { odooId: remoteEmployeeId }, select: { id: true } }) : null;
        if (remoteEmployeeId && !employee) throw new Error(`الموظف المعيّن للأصل ${row.id} غير مطابق في Lana`);
        const current = await tx.asset.findUnique({ where: { assetTag } });
        if (!current && serialNumber && await tx.asset.findFirst({ where: { serialNumber } })) {
          throw new Error(`يوجد أصل محلي بنفس الرقم التسلسلي للأصل ${row.id}. يلزم مراجعة المطابقة.`);
        }
        const assignedEmployeeId = employee?.id ?? null;
        const changed = assignedEmployeeId !== (current?.assignedEmployeeId ?? null);
        const assignment = changed ? { assignedAt: assignedEmployeeId ? new Date() : null, returnedAt: assignedEmployeeId ? null : new Date() } : {};
        const status: AssetStatus = current?.status === "MAINTENANCE" || current?.status === "RETIRED" ? current.status : assignedEmployeeId ? "ASSIGNED" : "AVAILABLE";
        const data = { name: String(row.name).trim(), category, serialNumber, assignedEmployeeId, status, ...assignment };
        await tx.asset.upsert({ where: { assetTag }, update: data, create: { assetTag, ...data } });
        return !current;
      }, { isolationLevel: "Serializable" });
      if (created) createdCount++;
      else updatedCount++;
    }
    if (rows.length < 100) break;
  }
  return { createdCount, updatedCount };
}
