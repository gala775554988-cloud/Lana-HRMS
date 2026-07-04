import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCurrentEmployee, getEmployeeDashboardData } from "@/lib/employee/data";
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

// SINGLE DATA SOURCE - one Prisma transaction + cache + safe fallbacks
async function DashboardContent({ employeeId }: { employeeId: string }) {
  const data = await getEmployeeDashboardData(employeeId);

  // Always render safely
  const attendance = data.attendance ?? { todayStatus: "absent" as const, hoursToday: 0, totalThisMonth: 0 };
  const leaveBalance = data.leaveBalance ?? {
    annual: { used: 0, remaining: 30, total: 30 },
    sick: { used: 0, remaining: 15, total: 15 },
  };
  const payroll = data.payroll ?? { baseSalary: 12500, currency: "SAR" };
  const requests = data.requests ?? { pending: 0, approved: 0, rejected: 0 };

  return (
    <>
      <KpiCards
        attendance={attendance}
        leaveBalance={leaveBalance}
        payroll={payroll}
        requests={requests}
      />

      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LatestNotifications notifications={data.notifications ?? []} />
        <RecentRequests requests={data.recentRequests ?? []} />
      </div>
    </>
  );
}
