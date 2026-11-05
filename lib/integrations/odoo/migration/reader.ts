import type { OdooClient } from "../client";
import type { OdooRecord, OdooDomain } from "../types";
import { externalId, MigrationRecordError } from "./mapping";
export async function requiredFields(client: OdooClient, model: string, required: string[], optional: string[] = []) {
  const metadata = await client.fieldsGet(model);
  if (required.some(field => !metadata[field])) throw new MigrationRecordError("MODEL_CONFIGURATION", "نموذج المصدر أو حقوله المطلوبة غير متاحة؛ راجع خريطة الحقول والصلاحيات");
  return { metadata, fields: [...new Set([...required, ...optional.filter(field => metadata[field])])] };
}
export async function readAll(client: OdooClient, model: string, domain: OdooDomain, fields: string[]) {
  const rows: OdooRecord[] = []; let last = 0;
  for (;;) {
    const batch = await client.search_read(model, [...domain, ["id", ">", last]], [...new Set(["id", ...fields])], { limit: 500, order: "id asc", context: { active_test: false } });
    rows.push(...batch); if (batch.length < 500) return rows;
    const next = externalId(batch.at(-1)?.id); if (!next || next <= last) throw new MigrationRecordError("INVALID_CURSOR", "مؤشر المصدر غير صالح"); last = next;
  }
}
export async function readPayslip(client: OdooClient, row: OdooRecord) {
  const header = await requiredFields(client,"hr.payslip",["id","employee_id","date_from","date_to","state","write_date","line_ids","company_id"],["name","number","move_id","currency_id","payslip_run_id","credit_note","contract_id","struct_id"]);
  const current = (await client.read("hr.payslip",[Number(row.id)],header.fields,{context:{active_test:false}}))[0];
  if (!current) throw new MigrationRecordError("SOURCE_MISSING", "سجل المصدر لم يعد متاحاً");
  const lineFields = await requiredFields(client,"hr.payslip.line",["id","name","code","amount","quantity","rate","total","slip_id"],["salary_rule_id","category_id","sequence"]);
  const lines = await readAll(client,"hr.payslip.line",[["slip_id","=",current.id]],lineFields.fields);
  const ids = (value: unknown) => Array.isArray(value) ? [...value].map(Number).sort((a,b)=>a-b) : [];
  if (!Array.isArray(current.line_ids) || JSON.stringify(ids(current.line_ids)) !== JSON.stringify(lines.map(line=>Number(line.id)).sort((a,b)=>a-b))) throw new MigrationRecordError("INCOMPLETE_LINES", "لم تصل جميع بنود الكشف؛ أعد المحاولة");
  const latest = (await client.read("hr.payslip",[Number(current.id)],["write_date","line_ids"],{context:{active_test:false}}))[0];
  if (!latest || latest.write_date !== current.write_date || JSON.stringify(ids(latest.line_ids)) !== JSON.stringify(ids(current.line_ids))) throw new MigrationRecordError("SOURCE_CHANGED", "تغير الكشف أثناء القراءة؛ أعد المحاولة");
  return { header:current, lines };
}
export async function currencyCode(client: OdooClient, row: OdooRecord, currencyField = "currency_id") {
  let id = externalId(row[currencyField]);
  if (!id && externalId(row.company_id)) id = externalId((await client.read("res.company",[externalId(row.company_id)!],["currency_id"]))[0]?.currency_id);
  if (!id) throw new MigrationRecordError("MISSING_CURRENCY", "عملة المصدر غير محددة");
  const code = String((await client.read("res.currency",[id],["name"]))[0]?.name ?? "");
  if (!/^[A-Z]{3}$/.test(code)) throw new MigrationRecordError("INVALID_CURRENCY", "عملة المصدر غير صالحة");
  return code;
}
