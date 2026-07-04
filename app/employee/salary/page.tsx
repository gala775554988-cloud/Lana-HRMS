import { getCurrentEmployee, getPayrollSummary } from "@/lib/employee/data";
import { SalaryView } from "@/components/employee/SalaryView";

export default async function SalaryPage() {
  const employee = await getCurrentEmployee();
  const payroll = employee ? await getPayrollSummary(employee.id) : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الرواتب</h1>
      <SalaryView payroll={payroll} />
    </div>
  );
}
