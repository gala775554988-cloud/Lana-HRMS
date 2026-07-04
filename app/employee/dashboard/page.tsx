import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee/data";
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
  const { 
    getAttendanceSummary, 
    getLeaveBalance, 
    getPayrollSummary, 
    getRequestSummary, 
    getRecentNotifications 
  } = await import("@/lib/employee/data");

  // Only load KPIs first (fast)
  const [attendance, leaveBalance, payroll, requests] = await Promise.all([
    getAttendanceSummary(employeeId),
    getLeaveBalance(employeeId),
    getPayrollSummary(employeeId),
    getRequestSummary(employeeId),
  ]);

  return (
    <>
      <KpiCards 
        attendance={attendance} 
        leaveBalance={leaveBalance} 
        payroll={payroll} 
        requests={requests} 
      />

      <QuickActions />

      {/* Lazy loaded sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100 rounded-2xl" />}>
          <LatestNotificationsLazy employeeId={employeeId} />
        </Suspense>

        <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100 rounded-2xl" />}>
          <RecentRequestsLazy employeeId={employeeId} />
        </Suspense>
      </div>
    </>
  );
}

// Lazy loaded components
async function LatestNotificationsLazy({ employeeId }: { employeeId: string }) {
  const { getRecentNotifications } = await import("@/lib/employee/data");
  const notifications = await getRecentNotifications(employeeId);
  return <LatestNotifications notifications={notifications} />;
}

async function RecentRequestsLazy({ employeeId }: { employeeId: string }) {
  const { prisma } = await import("@/lib/prisma");
  const requests = await prisma.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return <RecentRequests requests={requests} />;
}
