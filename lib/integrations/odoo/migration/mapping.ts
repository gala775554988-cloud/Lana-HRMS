import { z } from "zod";
export class MigrationRecordError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const field = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(100);
export const migrationConfigSchema = z.object({
  scope: z.enum(["FULL","PAYROLL"]).default("FULL"),
  connectionId: z.string().min(1).optional(),
  employeeNumberField: field.default("barcode"), nationalIdField: field.default("identification_id"), hireDateField: field.default("first_contract_date"),
  employeeStatusField: field.optional(), employeeStatusMap: z.record(z.enum(["ACTIVE", "INACTIVE", "RESIGNED", "DISMISSED"])).default({}),
  departureReasons: z.record(z.enum(["RESIGNED", "DISMISSED", "OTHER"])).default({}),
  loanModel: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_.]*$/).default("hr.loan"),
  loanFields: z.object({ employee: field.default("employee_id"), principal: field.default("loan_amount"), balance: field.default("balance_amount"), state: field.default("state"), currency: field.default("currency_id"), date: field.default("date"), lines: field.default("loan_lines") }).default({}),
  installmentFields: z.object({ loan: field.default("loan_id"), date: field.default("date"), amount: field.default("amount"), paid: field.default("paid") }).default({}),
  loanStateMap: z.record(z.enum(["PENDING", "ACTIVE", "PAID", "CANCELLED"])).default({ draft: "PENDING", waiting_approval_1: "PENDING", waiting_approval_2: "PENDING", approve: "ACTIVE", close: "PAID", cancel: "CANCELLED" }),
  fromMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), toMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict().refine(config => !config.fromMonth || !config.toMonth || config.fromMonth <= config.toMonth, "فترة غير صالحة");
export type MigrationConfig = z.infer<typeof migrationConfigSchema>;
export function externalId(value: unknown): number | null { const raw = Array.isArray(value) ? value[0] : value; return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : null; }
export function sourceDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(value)) throw new MigrationRecordError("INVALID_DATE", "تاريخ مطلوب مفقود أو غير صالح في المصدر");
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value.slice(0,10)) throw new MigrationRecordError("INVALID_DATE", "تاريخ المصدر غير صالح");
  return date;
}
export function identity(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
export function employeeStatus(row: Record<string, unknown>, config: MigrationConfig) {
  const mapped = config.employeeStatusField ? config.employeeStatusMap[String(row[config.employeeStatusField])] : undefined;
  const reason = config.departureReasons[String(externalId(row.departure_reason_id))];
  const workingStatus = mapped ?? (row.active === false ? reason ?? "INACTIVE" : "ACTIVE");
  if (config.employeeStatusField && !mapped) throw new MigrationRecordError("UNMAPPED_STATUS", "حالة الموظف تحتاج خريطة معتمدة");
  return { status: workingStatus === "RESIGNED" || workingStatus === "DISMISSED" ? "TERMINATED" as const : workingStatus === "ACTIVE" ? "ACTIVE" as const : "INACTIVE" as const, workingStatus };
}
export function decimalUnits(value: unknown): bigint {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value : "";
  if (!/^-?\d{1,14}(?:\.\d{1,6})?$/.test(text)) throw new MigrationRecordError("INVALID_MONEY", "قيمة المصدر غير صالحة أو تتجاوز الدقة المالية المدعومة (6 منازل)");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  return (BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6,"0"))) * (text.startsWith("-") ? -BigInt(1) : BigInt(1));
}
export function decimalText(units: bigint) { return `${units < 0 ? "-" : ""}${(units < 0 ? -units : units) / BigInt(1000000)}.${String((units < 0 ? -units : units) % BigInt(1000000)).padStart(6,"0")}`; }
export function reconcilePayroll(lines: { code: unknown; total: unknown }[], rules: Map<string, string>) {
  const mapped = lines.map(line => ({ category: rules.get(String(line.code)) ?? ({ BASIC: "BASIC", GROSS: "GROSS", NET: "NET" } as Record<string,string>)[String(line.code)], total: decimalUnits(line.total) }));
  if (mapped.some(line => !line.category)) throw new MigrationRecordError("UNMAPPED_SALARY_RULE", "توجد بنود راتب غير مصنفة؛ اضبط قواعد الرواتب ثم أعد المحاولة");
  const one = (category: string) => { const rows = mapped.filter(row => row.category === category); if (rows.length !== 1) throw new MigrationRecordError("MISSING_TOTAL", "يلزم بند أساسي وإجمالي وصافي واحد لكل كشف"); return rows[0].total; };
  const basic = one("BASIC"), gross = one("GROSS"), net = one("NET");
  const allowances = mapped.filter(row => row.category === "ALLOWANCE").reduce((sum,row) => sum + row.total,BigInt(0));
  const deductions = mapped.filter(row => row.category === "DEDUCTION").reduce((sum,row) => sum + (row.total < 0 ? -row.total : row.total),BigInt(0));
  if (gross !== basic + allowances || net !== gross - deductions) throw new MigrationRecordError("PAYROLL_MISMATCH", "الأساسي والبدلات والاستقطاعات لا تطابق الإجمالي والصافي بدقة المصدر");
  return { basic: decimalText(basic), gross: decimalText(gross), deductions: decimalText(deductions), net: decimalText(net), categories: mapped.map(row => row.category) };
}
export function nextMonth(month: string) { const [year,m] = month.split("-").map(Number); return `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2,"0")}`; }
