import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCurrentEmployee, getAttendanceSummary, getLeaveBalance, getPayrollSummary, getRequestSummary, getRecentTasks, getRecentNotifications } from "@/lib/employee/data";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";

export default async function EmployeeDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const employee = await getCurrentEmployee();
  if (!employee) {
    return <div className="p-8">لم يتم العثور على بيانات الموظف. يرجى التواصل مع HR.</div>;
  }

  const [attendance, leaveBalance, payroll, requestsSummary, tasks, notifications] = await Promise.all([
    getAttendanceSummary(employee.id),
    getLeaveBalance(employee.id),
    getPayrollSummary(employee.id),
    getRequestSummary(employee.id),
    getRecentTasks(employee.id),
    getRecentNotifications(employee.id),
  ]);

  return (
    <EmployeeDashboard
      employee={employee}
      attendance={attendance}
      leaveBalance={leaveBalance}
      payroll={payroll}
      requestsSummary={requestsSummary}
      tasks={tasks}
      notifications={notifications}
    />
  );
}
