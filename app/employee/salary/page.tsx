import { getCurrentEmployee, getPayrollSummary } from "@/lib/employee/data";
import { SalaryPage } from "@/components/employee/SalaryPage";

export default async function Salary() {
  const employee = await getCurrentEmployee();
  const payroll = employee ? await getPayrollSummary(employee.id) : { baseSalary: 12500, currency: "SAR" };
  return <SalaryPage employee={employee} payroll={payroll} />;
}
