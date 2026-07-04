import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardHeader } from "@/components/employee/DashboardHeader";
import { KpiCards } from "@/components/employee/KpiCards";
import { QuickActions } from "@/components/employee/QuickActions";
import { RecentRequests } from "@/components/employee/RecentRequests";
import { LatestNotifications } from "@/components/employee/LatestNotifications";
import { DashboardContentSkeleton } from "@/components/employee/skeletons";

export const dynamic = 'force-dynamic';

export default async function EmployeeDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    include: { department: true, position: true, branch: true },
  });

  if (!employee) {
    return <div className="p-8 text-center">لم يتم العثور على بيانات الموظف.</div>;
  }

  return (
    <div className="space-y-8">
      <DashboardHeader employee={employee as any} />
      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardContent employeeId={employee.id} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ employeeId }: { employeeId: string }) {
  let data: any = null;

  try {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    const userId = emp?.userId;

    const [
      attendanceToday,
      attendanceMonth,
      approvedLeaves,
      latestPayroll,
      pendingCount,
      approvedCount,
      rejectedCount,
      recentLeaves,
      recentOvertimes,
      auditLogs,
      notifs,
    ] = await prisma.$transaction([
      prisma.attendanceRecord.findFirst({ where: { employeeId, workDate: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
      prisma.attendanceRecord.findMany({ where: { employeeId, workDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      prisma.leaveRequest.findMany({ where: { employeeId, status: "APPROVED" }, include: { leaveType: true } }),
      prisma.payrollItem.findFirst({ where: { employeeId }, orderBy: { createdAt: "desc" } }),
      prisma.leaveRequest.count({ where: { employeeId, status: "PENDING" } }),
      prisma.leaveRequest.count({ where: { employeeId, status: "APPROVED" } }),
      prisma.leaveRequest.count({ where: { employeeId, status: "REJECTED" } }),
      prisma.leaveRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.overtimeRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" }, take: 2 }),
      prisma.auditLog.findMany({ where: { entity: { in: ["leave","loan","overtime","expense"] }, metadata: { path: ["employeeId"], equals: employeeId } }, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.notification.findMany({ where: { userId: userId ?? undefined }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    let totalHours = 0;
    (attendanceMonth || []).forEach((r: any) => {
      if (r.checkIn && r.checkOut) totalHours += Math.max(0, (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60));
    });

    data = {
      attendance: {
        todayStatus: attendanceToday?.status === "PRESENT" ? "present" : attendanceToday?.checkOut ? "checked-out" : "absent",
        hoursToday: attendanceToday?.checkIn && attendanceToday?.checkOut ? Math.max(0, (new Date(attendanceToday.checkOut).getTime() - new Date(attendanceToday.checkIn).getTime()) / (1000 * 60 * 60)) : 0,
        totalThisMonth: Math.round(totalHours),
      },
      leaveBalance: { annual: { used: 0, remaining: 30, total: 30 }, sick: { used: 0, remaining: 15, total: 15 } },
      payroll: { baseSalary: latestPayroll ? Number(latestPayroll.baseSalary) : 12500, currency: latestPayroll?.currency || "SAR" },
      requests: { pending: pendingCount || 0, approved: approvedCount || 0, rejected: rejectedCount || 0 },
      recentRequests: (recentLeaves || []).map((l: any) => ({ id: l.id, kind: "إجازة", status: l.status, createdAt: l.createdAt })),
      notifications: [
        ...(auditLogs || []).map((log: any) => ({ id: log.id, title: `تم ${log.action === "create" ? "تقديم" : "تحديث"} ${log.entity}`, createdAt: log.createdAt.toISOString() })),
        ...(notifs || []).map((n: any) => ({ id: n.id, title: n.title, createdAt: n.createdAt.toISOString() })),
      ].slice(0, 5),
    };
  } catch (e) {
    console.error("[Dashboard] Error:", e);
    data = null;
  }

  const attendance = data?.attendance ?? { todayStatus: "absent" as const, hoursToday: 0, totalThisMonth: 0 };
  const leaveBalance = data?.leaveBalance ?? { annual: { used: 0, remaining: 30, total: 30 }, sick: { used: 0, remaining: 15, total: 15 } };
  const payroll = data?.payroll ?? { baseSalary: 12500, currency: "SAR" };
  const requests = data?.requests ?? { pending: 0, approved: 0, rejected: 0 };
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const recentRequests = Array.isArray(data?.recentRequests) ? data.recentRequests : [];

  return (
    <>
      <KpiCards attendance={attendance} leaveBalance={leaveBalance} payroll={payroll} requests={requests} />
      <QuickActions />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LatestNotifications notifications={notifications} />
        <RecentRequests requests={recentRequests} />
      </div>
      {!data && <div className="text-xs px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">تم عرض بيانات احتياطية.</div>}
    </>
  );
}
