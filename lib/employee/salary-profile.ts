import { prisma } from "@/lib/prisma";

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
  "salaryNet"
] as const;

export type SalaryProfileField = (typeof salaryProfileFields)[number];
export type SalaryProfile = Partial<Record<SalaryProfileField, number>>;

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
  salaryNet: "صافي الراتب"
};

export function extractSalaryProfile(values: Record<string, unknown>): SalaryProfile {
  const salary: SalaryProfile = {};
  for (const field of salaryProfileFields) {
    const value = values[field];
    if (value === undefined || value === null || value === "") continue;
    const numberValue = Number(value);
    if (!Number.isNaN(numberValue)) salary[field] = numberValue;
  }
  return salary;
}

export function calculateNetSalary(salary: SalaryProfile) {
  const base = salary.salaryBase ?? 0;
  const allowances = (salary.salaryHousingAllowance ?? 0) + (salary.salaryTransportAllowance ?? 0) + (salary.salaryFoodAllowance ?? 0) + (salary.salaryCommunicationAllowance ?? 0) + (salary.salaryOtherAllowances ?? 0);
  const additions = (salary.salaryBonuses ?? 0) + (salary.salaryOvertime ?? 0);
  const deductions = salary.salaryDeductions ?? 0;
  return base + allowances + additions - deductions;
}

export function hasSalaryProfile(salary: SalaryProfile) {
  return salaryProfileFields.some((field) => salary[field] !== undefined && salary[field] !== null);
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
  const withNet: SalaryProfile = {
    ...salary,
    salaryNet: salary.salaryNet ?? calculateNetSalary(salary)
  };
  return prisma.appSetting.upsert({
    where: { key: keyForEmployee(employeeId) },
    update: { value: withNet },
    create: { key: keyForEmployee(employeeId), value: withNet, description: "Employee salary profile" }
  });
}
