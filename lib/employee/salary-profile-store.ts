import { prisma } from "@/lib/prisma";
import {
  calculateInsuranceDeduction,
  calculateNetSalary,
  calculateTotalSalary,
  extractSalaryProfile,
  hasSalaryProfile,
  type SalaryProfile
} from "@/lib/employee/salary-profile";

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
    salaryNet: salary.salaryNet ?? calculateNetSalary(salary),
    salaryInsuranceDeduction: insuranceDeduction,
    salaryTotal: calculateTotalSalary({ ...salary, salaryInsuranceDeduction: insuranceDeduction })
  };
  return prisma.appSetting.upsert({
    where: { key: keyForEmployee(employeeId) },
    update: { value: withTotals },
    create: { key: keyForEmployee(employeeId), value: withTotals, description: "Employee salary profile" }
  });
}
