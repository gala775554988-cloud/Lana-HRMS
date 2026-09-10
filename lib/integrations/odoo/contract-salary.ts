import type { SalaryProfile } from "@/lib/employee/salary-profile";

type FieldMeta = Record<string, { string?: unknown; type?: unknown }>;

const CORE_CONTRACT_FIELDS = [
  "id", "employee_id", "name", "state", "wage", "date_start", "date_end", "write_date",
  "structure_type_id", "struct_id", "resource_calendar_id", "job_id", "department_id", "company_id",
  "trial_date_end", "schedule_pay", "wage_type", "hr_responsible_id",
] as const;

const SALARY_NAME_PATTERN = /(wage|salary|allowance|housing|transport|food|meal|mobile|communication|bonus|deduction|overtime|insurance)/i;
const SENSITIVE_NAME_PATTERN = /(bank|iban|swift|account_number|credit_card)/i;

export function discoverContractFields(meta: FieldMeta, extraFields: string[] = []) {
  const salaryFields = Object.entries(meta)
    .filter(([name, descriptor]) => {
      const searchable = `${name} ${String(descriptor?.string ?? "")}`;
      return SALARY_NAME_PATTERN.test(searchable)
        && !SENSITIVE_NAME_PATTERN.test(searchable)
        && !["binary", "one2many", "many2many"].includes(String(descriptor?.type ?? ""));
    })
    .map(([name]) => name);

  return [...new Set([...CORE_CONTRACT_FIELDS, ...extraFields, ...salaryFields])]
    .filter((field) => field === "id" || Boolean(meta[field]));
}

function amount(value: unknown): number | undefined {
  if (value === false || value === null || value === undefined || value === "") return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function firstAmount(record: Record<string, unknown>, aliases: string[], pattern?: RegExp) {
  for (const alias of aliases) {
    const value = amount(record[alias]);
    if (value !== undefined) return value;
  }
  if (pattern) {
    for (const [key, raw] of Object.entries(record)) {
      if (!pattern.test(key) || SENSITIVE_NAME_PATTERN.test(key)) continue;
      const value = amount(raw);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function salaryProfileFromOdooContract(contract: Record<string, unknown>): SalaryProfile {
  const profile: SalaryProfile = {
    salaryBase: firstAmount(contract, ["wage", "basic_wage", "basic_salary", "salary_base"], /(basic.*(wage|salary)|(wage|salary).*basic)/i),
    salaryHousingAllowance: firstAmount(contract, ["housing_allowance", "house_allowance", "accommodation_allowance"], /(housing|house|accommodation)/i),
    salaryTransportAllowance: firstAmount(contract, ["transport_allowance", "transportation_allowance"], /transport/i),
    salaryFoodAllowance: firstAmount(contract, ["food_allowance", "meal_allowance"], /(food|meal)/i),
    salaryCommunicationAllowance: firstAmount(contract, ["communication_allowance", "mobile_allowance", "phone_allowance"], /(communication|mobile|phone)/i),
    salaryOtherAllowances: firstAmount(contract, ["other_allowances", "other_allowance"], /other.*allowance/i),
    salaryBonuses: firstAmount(contract, ["bonus", "bonuses"], /bonus/i),
    salaryDeductions: firstAmount(contract, ["deduction", "deductions"], /deduction/i),
    salaryOvertime: firstAmount(contract, ["overtime", "overtime_amount"], /overtime/i),
    salaryNet: firstAmount(contract, ["net_wage", "net_salary"], /net.*(wage|salary)/i),
    salaryInsuranceDeduction: firstAmount(contract, ["insurance_deduction"], /insurance.*deduction/i),
  };

  for (const key of Object.keys(profile) as Array<keyof SalaryProfile>) {
    if (profile[key] === undefined) delete profile[key];
  }
  return profile;
}

export function odooStructureName(contract: Record<string, unknown>) {
  for (const field of ["structure_type_id", "struct_id"]) {
    const value = contract[field];
    if (Array.isArray(value) && value.length > 1) return String(value[1]);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}
