// Pure, client-safe salary calculation helpers -- no Prisma import here on
// purpose. This file gets imported directly by a client component
// (module-form.tsx) for the calculation functions; server-only reads/writes
// (getEmployeeSalaryProfile/saveEmployeeSalaryProfile) live in
// ./salary-profile-store.ts instead, so importing them can't drag the
// Prisma client's browser runtime into the client bundle again the way it
// did when they were all one file.

export const SOCIAL_INSURANCE_RATE = 0.09;

export const salaryProfileFields = [
  "salaryBase",
  "salaryHousingAllowance",
  "salaryTransportAllowance",
  "salaryFoodAllowance",
  "salaryCommunicationAllowance",
  "salaryOtherAllowances",
  "salaryBonuses",
  "salaryDeductions",
  "salaryOvertime",
  "salaryNet",
  "salaryInsuranceDeduction",
  "salaryTotal"
] as const;

export type SalaryProfileField = (typeof salaryProfileFields)[number];
export type SalaryProfile = Partial<Record<SalaryProfileField, number>> & {
  salaryDeductInsurance?: boolean;
  salaryCosts?: number[];
};

export const salaryProfileLabels: Record<SalaryProfileField, string> = {
  salaryBase: "الراتب الأساسي",
  salaryHousingAllowance: "بدل السكن",
  salaryTransportAllowance: "بدل النقل",
  salaryFoodAllowance: "بدل الطعام",
  salaryCommunicationAllowance: "بدل الاتصالات",
  salaryOtherAllowances: "بدلات أخرى",
  salaryBonuses: "مكافآت",
  salaryDeductions: "خصومات",
  salaryOvertime: "إضافي",
  salaryNet: "صافي الراتب",
  salaryInsuranceDeduction: "خصم التأمينات",
  salaryTotal: "إجمالي الراتب"
};

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? undefined : numberValue;
}

export function extractSalaryProfile(values: Record<string, unknown>): SalaryProfile {
  const salary: SalaryProfile = {};
  for (const field of salaryProfileFields) {
    const numberValue = toNumber(values[field]);
    if (numberValue !== undefined) salary[field] = numberValue;
  }
  salary.salaryDeductInsurance = values.salaryDeductInsurance === true || values.salaryDeductInsurance === "true";
  const costs = Array.isArray(values.salaryCosts) ? values.salaryCosts : values.salaryCosts ? [values.salaryCosts] : [];
  salary.salaryCosts = costs.map(toNumber).filter((value): value is number => value !== undefined);
  return salary;
}

export function calculateInsuranceDeduction(salary: SalaryProfile) {
  if (!salary.salaryDeductInsurance) return 0;
  return (salary.salaryBase ?? 0) * SOCIAL_INSURANCE_RATE;
}

export function calculateNetSalary(salary: SalaryProfile) {
  const base = salary.salaryBase ?? 0;
  const allowances = (salary.salaryHousingAllowance ?? 0) + (salary.salaryTransportAllowance ?? 0) + (salary.salaryFoodAllowance ?? 0) + (salary.salaryCommunicationAllowance ?? 0) + (salary.salaryOtherAllowances ?? 0);
  const additions = (salary.salaryBonuses ?? 0) + (salary.salaryOvertime ?? 0);
  const deductions = salary.salaryDeductions ?? 0;
  return base + allowances + additions - deductions;
}

export function calculateTotalSalary(salary: SalaryProfile) {
  return calculateNetSalary(salary) - calculateInsuranceDeduction(salary);
}

export function hasSalaryProfile(salary: SalaryProfile) {
  return salaryProfileFields.some((field) => salary[field] !== undefined && salary[field] !== null) || Boolean(salary.salaryDeductInsurance) || Boolean(salary.salaryCosts?.length);
}
