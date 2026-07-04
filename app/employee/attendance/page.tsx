import { getCurrentEmployee, getAttendanceSummary } from "@/lib/employee/data";
import { AttendanceClient } from "@/components/employee/AttendanceClient";

export default async function AttendancePage() {
  const employee = await getCurrentEmployee();
  if (!employee) return <div>خطأ</div>;

  const summary = await getAttendanceSummary(employee.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الحضور والانصراف</h1>
        <p className="text-slate-500">سجل حضورك اليومي</p>
      </div>

      <AttendanceClient employeeId={employee.id} summary={summary} />
    </div>
  );
}
