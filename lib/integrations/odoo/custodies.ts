import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { OdooJsonRpcClient } from "@/lib/integrations/odoo";

// Verified against Lana's العهد العينية application. This is a custody
// request model; maintenance.equipment is a different application entirely.
const MODEL = "asset.account.request";
type Field = { type: string; relation?: string };
type Row = { id: number; [key: string]: unknown };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const relationId = (value: unknown) => Array.isArray(value) && Number.isSafeInteger(value[0]) && value[0] > 0 ? Number(value[0]) : null;
function date(value: unknown) {
  if (value === false || value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(value)) throw new Error("INVALID_DATE");
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : `${value.replace(" ", "T")}Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error("INVALID_DATE");
  return parsed;
}

export async function importOdooCustodies(client: Pick<OdooJsonRpcClient, "execute" | "searchRead">, source: string) {
  let fields: Record<string, Field>;
  try {
    fields = await client.execute(MODEL, "fields_get", [], { attributes: ["type", "relation"] });
  } catch {
    throw new Error("تعذر قراءة العهد العينية من اتصال أودو المحدد. تحقق من قاعدة البيانات وصلاحية قراءة العهد العينية.");
  }
  for (const key of ["name", "state", "description", "employee_id"]) {
    if (!fields[key]) throw new Error(`حقل العهد العينية غير متاح: ${key}`);
  }
  if (fields.employee_id.type !== "many2one" || fields.employee_id.relation !== "hr.employee") throw new Error("حقل موظف العهدة لا يشير إلى الموظفين في أودو");
  const binding = await prisma.appSetting.findUnique({ where: { key: "odoo.migration.employeeSource" }, select: { value: true } });
  if (binding && binding.value !== source) throw new Error("اتصال العهد يختلف عن مصدر الموظفين. اختر اتصال أودو الذي استُورد منه الموظفون.");
  const employeeFields = !binding ? await client.execute<Record<string, Field>>("hr.employee", "fields_get", [], { attributes: ["type"] }) : {};
  const identityColumns = ["identification_id", "work_email"].filter(key => employeeFields[key]);
  const columns = ["id", "name", "state", "description", "employee_id", "type", "asset_request_description", "asset_request_Reason", "asset_request_startDate", "asset_request_deliveryDate", "date_of_asset_delivery", "date", "date_of_disclaimer", "state_of_asset_when_receive", "state_of_asset_when_delivery"].filter(key => key === "id" || fields[key]);
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 20);
  const progressKey = `odoo.custody.sync.${hash}`;
  let lastId = 0, createdCount = 0, updatedCount = 0, skippedCount = 0, pendingCount = 0;
  const errors: { id: number; code: string }[] = [];
  const checkpoint = await prisma.appSetting.findUnique({ where: { key: progressKey }, select: { value: true } });
  if (checkpoint) {
    try {
      const prior = typeof checkpoint.value === "string" ? JSON.parse(checkpoint.value) : checkpoint.value;
      if (!prior || typeof prior !== "object") throw new Error("INVALID_CHECKPOINT");
      const counts = [prior.lastId, prior.createdCount, prior.updatedCount, prior.skippedCount, prior.pendingCount];
      if (prior.model === MODEL && prior.completed === false && counts.every(value => Number.isSafeInteger(value) && value >= 0)) {
        [lastId, createdCount, updatedCount, skippedCount, pendingCount] = counts;
        if (Array.isArray(prior.errors)) errors.push(...prior.errors.filter((item: { id?: number; code?: string }) => Number.isSafeInteger(item?.id) && typeof item?.code === "string" && /^[A-Z_]+$/.test(item.code)).slice(0, 100));
      }
    } catch { /* Invalid older checkpoint: safely replay idempotent upserts. */ }
  }
  for (;;) {
    const rows = await client.searchRead<Row>(MODEL, [["id", ">", lastId]], columns, { order: "id asc", limit: 500, context: { active_test: false } });
    if (!rows.length) break;
    // A broken remote cursor must not loop forever or silently omit records.
    let cursor = lastId;
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id <= cursor) throw new Error("تعذر قراءة تسلسل سجلات العهد من أودو");
      cursor = row.id;
    }
    const remoteIds = [...new Set(rows.map(row => relationId(row.employee_id)).filter((id): id is number => id !== null))];
    const localEmployees = await prisma.employee.findMany({ where: { odooId: { in: remoteIds } }, select: { id: true, odooId: true, nationalId: true, email: true } });
    const localById = new Map(localEmployees.map(employee => [employee.odooId, employee]));
    const remoteEmployees = !binding && remoteIds.length && identityColumns.length ? await client.searchRead<Row>("hr.employee", [["id", "in", remoteIds]], ["id", ...identityColumns], { limit: 500, context: { active_test: false } }) : [];
    const remoteById = new Map(remoteEmployees.map(employee => [employee.id, employee]));
    for (const row of rows) {
      lastId = row.id;
      try {
        const state = text(row.state);
        if (["draft", "submit", "approve", "refuse"].includes(state)) { pendingCount++; continue; }
        if (state !== "assigned" && state !== "clearance") throw new Error("UNKNOWN_STATE");
        const remoteId = relationId(row.employee_id);
        const employee = remoteId ? localById.get(remoteId) : null;
        if (!employee) throw new Error("EMPLOYEE_NOT_MATCHED");
        if (!binding) {
          // Older imports did not persist a source binding. Corroborate the
          // existing Odoo ID with identity data without changing employee data.
          const remote = remoteById.get(remoteId!);
          const nationalId = text(remote?.identification_id);
          const email = text(remote?.work_email).toLowerCase();
          const matched = nationalId ? nationalId === employee.nationalId : Boolean(email && email === employee.email?.trim().toLowerCase());
          if (!matched) throw new Error("EMPLOYEE_SOURCE_UNVERIFIED");
        }
        const name = text(row.description) || text(row.asset_request_description) || text(row.name);
        if (!name) throw new Error("MISSING_DESCRIPTION");
        const assetTag = `ODOO-CUSTODY-${hash}-${row.id}`;
        const assignedAt = date(row.date_of_asset_delivery || row.date);
        const returnedAt = state === "clearance" ? date(row.date_of_disclaimer) : null;
        const created = await prisma.$transaction(async tx => {
          const current = await tx.asset.findUnique({ where: { assetTag } });
          const data = { name, category: "عهد عينية", status: state === "assigned" ? "ASSIGNED" as const : "AVAILABLE" as const,
            assignedEmployeeId: state === "assigned" ? employee.id : null, assignedAt, returnedAt };
          const asset = await tx.asset.upsert({ where: { assetTag }, update: data, create: { assetTag, ...data } });
          const key = `odoo.custody.record.${asset.id}`;
          const value = JSON.stringify({ source, model: MODEL, remoteId: row.id, reference: text(row.name), state, employeeId: employee.id,
            requestDescription: text(row.asset_request_description), reason: text(row.asset_request_Reason), type: text(row.type),
            requestedAt: date(row.asset_request_startDate), dueAt: date(row.asset_request_deliveryDate),
            receivedCondition: text(row.state_of_asset_when_receive), returnedCondition: text(row.state_of_asset_when_delivery) });
          await tx.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
          return !current;
        }, { isolationLevel: "Serializable" });
        if (created) createdCount++; else updatedCount++;
      } catch (error) {
        skippedCount++;
        const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "IMPORT_FAILED";
        if (errors.length < 100) errors.push({ id: row.id, code });
      }
    }
    const value = JSON.stringify({ model: MODEL, lastId, createdCount, updatedCount, skippedCount, pendingCount, errors, completed: false, updatedAt: new Date().toISOString() });
    await prisma.appSetting.upsert({ where: { key: progressKey }, create: { key: progressKey, value }, update: { value } });
    if (rows.length < 500) break;
  }
  const result = { model: MODEL, lastId, createdCount, updatedCount, skippedCount, pendingCount, errors, completed: true, updatedAt: new Date().toISOString() };
  await prisma.appSetting.upsert({ where: { key: progressKey }, create: { key: progressKey, value: JSON.stringify(result) }, update: { value: JSON.stringify(result) } });
  return result;
}
