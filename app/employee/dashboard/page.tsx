import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCurrentEmployee, getAttendanceSummary, getLeaveBalance, getPayrollSummary, getRequestSummary, getRecentNotifications } from "@/lib/employee/data";
import { DashboardHeader } from "@/components/employee/DashboardHeader";
import { KpiCards } from "@/components/employee/KpiCards";
import { QuickActions } from "@/components/employee/QuickActions";
import { RecentRequests } from "@/components/employee/RecentRequests";
import { LatestNotifications } from "@/components/employee/LatestNotifications";
import { DashboardContentSkeleton } from "@/components/employee/skeletons";

export default async function EmployeeDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");

  return (
    <div className="space-y-8">
      <DashboardHeader employee={employee} />

      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardContent employeeId={employee.id} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ employeeId }: { employeeId: string }) {
  const [attendance, leaveBalance, payroll, requests, notifications] = await Promise.all([
    getAttendanceSummary(employeeId),
    getLeaveBalance(employeeId),
    getPayrollSummary(employeeId),
    getRequestSummary(employeeId),
    getRecentNotifications(employeeId),
  ]);

  return (
    <>
      {/* KPI Cards */}
      <KpiCards 
        attendance={attendance} 
        leaveBalance={leaveBalance} 
        payroll={payroll} 
        requests={requests} 
      />

      {/* Quick Actions + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
        <div>
          <LatestNotifications notifications={notifications} />
        </div>
      </div>

      {/* Recent Requests */}
      <RecentRequests employeeId={employeeId} />
    </>
  );
}
