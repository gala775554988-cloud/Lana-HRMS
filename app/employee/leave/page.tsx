import { getCurrentEmployee, getLeaveBalance } from "@/lib/employee/data";
import { LeavePage } from "@/components/employee/LeavePage";

export default async function Leave() {
  const employee = await getCurrentEmployee();
  if (!employee) return <div>لا توجد بيانات</div>;
  const balance = await getLeaveBalance(employee.id);
  return <LeavePage employee={employee} balance={balance} />;
}
