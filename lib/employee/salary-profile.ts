import { prisma } from "@/lib/prisma";

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

export function calculateTotalSalary(salary: SalaryProfile) {
  const base = salary.salaryBase ?? 0;
  const allowances = (salary.salaryHousingAllowance ?? 0) + (salary.salaryTransportAllowance ?? 0) + (salary.salaryFoodAllowance ?? 0) + (salary.salaryCommunicationAllowance ?? 0) + (salary.salaryOtherAllowances ?? 0);
  const additions = (salary.salaryBonuses ?? 0) + (salary.salaryOvertime ?? 0);
  const deductions = salary.salaryDeductions ?? 0;
  const insurance = calculateInsuranceDeduction(salary);
  return base + allowances + additions - deductions - insurance;
}

export function hasSalaryProfile(salary: SalaryProfile) {
  return salaryProfileFields.some((field) => salary[field] !== undefined && salary[field] !== null) || Boolean(salary.salaryDeductInsurance) || Boolean(salary.salaryCosts?.length);
}

function keyForEmployee(employeeId: string) {
  return `employee.salary.${employeeId}`;
}

export async function getEmployeeSalaryProfile(employeeId: string): Promise<SalaryProfile> {
  const setting = await prisma.appSetting.findUnique({ where: { key: keyForEmployee(employeeId) } }).catch(() => null);
  if (!setting?.value || typeof setting.value !== "object") return {};
  return extractSalaryProfile(setting.value as Record<string, unknown>);
}

export async function saveEmployeeSalaryProfile(employeeId: string, salary: SalaryProfile) {
  if (!hasSalaryProfile(salary)) return null;
  const insuranceDeduction = calculateInsuranceDeduction(salary);
  const withTotals: SalaryProfile = {
    ...salary,
    salaryInsuranceDeduction: insuranceDeduction,
    salaryTotal: calculateTotalSalary({ ...salary, salaryInsuranceDeduction: insuranceDeduction })
  };
  return prisma.appSetting.upsert({
    where: { key: keyForEmployee(employeeId) },
    update: { value: withTotals },
    create: { key: keyForEmployee(employeeId), value: withTotals, description: "Employee salary profile" }
  });
}
