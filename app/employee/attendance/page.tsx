import { getCurrentEmployee, getAttendanceSummary } from "@/lib/employee/data";
import { AttendancePage } from "@/components/employee/AttendancePage";

export default async function Attendance() {
  const employee = await getCurrentEmployee();
  if (!employee) return <div>لا توجد بيانات</div>;

  const summary = await getAttendanceSummary(employee.id);

  return <AttendancePage employee={employee} summary={summary} />;
}
