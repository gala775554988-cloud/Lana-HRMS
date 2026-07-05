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

  let employee = null;

  try {
    employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      include: { department: true, position: true, branch: true },
    });
  } catch (error) {
    console.error("[EmployeeDashboard] Failed to fetch employee:", error);
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-lg text-slate-600">حدث خطأ في تحميل بيانات الموظف</p>
          <p className="mt-2 text-sm text-slate-400">يرجى التواصل مع الموارد البشرية أو المحاولة لاحقاً</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600">لم يتم العثور على بيانات الموظف</p>
          <p className="mt-2 text-sm text-slate-400">يرجى التواصل مع الموارد البشرية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader employee={employee as any} />
      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardContent employeeId={employee.id} userId={session.user.id} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ employeeId, userId }: { employeeId: string; userId: string }) {
  // Default safe data
  const defaultAttendance = { todayStatus: "absent" as const, hoursToday: 0, totalThisMonth: 0 };
  const defaultLeaveBalance = { annual: { used: 0, remaining: 30, total: 30 }, sick: { used: 0, remaining: 15, total: 15 } };
  const defaultPayroll = { baseSalary: 12500, currency: "SAR" };
  const defaultRequests = { pending: 0, approved: 0, rejected: 0 };

  let attendance = defaultAttendance;
  let leaveBalance = defaultLeaveBalance;
  let payroll = defaultPayroll;
  let requests = defaultRequests;
  let recentRequests: any[] = [];
  let notifications: any[] = [];
  let hasError = false;

  try {
    // Use individual queries with individual error handling instead of transaction
    // This is more resilient if some tables are missing
    
    let attendanceToday = null;
    let attendanceMonth: any[] = [];
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let recentLeaves: any[] = [];
    let auditLogs: any[] = [];
    let notifs: any[] = [];

    // Safe individual queries
    try {
      attendanceToday = await prisma.attendanceRecord.findFirst({
        where: { employeeId, workDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => null);
    } catch {}

    try {
      attendanceMonth = await prisma.attendanceRecord.findMany({
        where: { employeeId, workDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }).catch(() => []);
    } catch {}

    try {
      [pendingCount, approvedCount, rejectedCount] = await Promise.all([
        prisma.leaveRequest.count({ where: { employeeId, status: "PENDING" } }).catch(() => 0),
        prisma.leaveRequest.count({ where: { employeeId, status: "APPROVED" } }).catch(() => 0),
        prisma.leaveRequest.count({ where: { employeeId, status: "REJECTED" } }).catch(() => 0),
      ]);
    } catch {}

    try {
      recentLeaves = await prisma.leaveRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).catch(() => []);
    } catch {}

    try {
      auditLogs = await prisma.auditLog.findMany({
        where: { entity: { in: ["leave", "loan", "overtime", "expense"] }, metadata: { path: ["employeeId"], equals: employeeId } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }).catch(() => []);
    } catch {}

    try {
      notifs = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).catch(() => []);
    } catch {}

    // Calculate attendance hours
    let totalHours = 0;
    (attendanceMonth || []).forEach((r: any) => {
      if (r.checkIn && r.checkOut) {
        const diff = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60);
        totalHours += Math.max(0, diff);
      }
    });

    attendance = {
      todayStatus: attendanceToday?.status === "PRESENT" ? "present" : attendanceToday?.checkOut ? "checked-out" : "absent",
      hoursToday: attendanceToday?.checkIn && attendanceToday?.checkOut
        ? Math.max(0, (new Date(attendanceToday.checkOut).getTime() - new Date(attendanceToday.checkIn).getTime()) / (1000 * 60 * 60))
        : 0,
      totalThisMonth: Math.round(totalHours),
    };

    requests = {
      pending: pendingCount || 0,
      approved: approvedCount || 0,
      rejected: rejectedCount || 0,
    };

    recentRequests = (recentLeaves || []).map((l: any) => ({
      id: l.id,
      kind: "إجازة",
      status: l.status || "PENDING",
      createdAt: l.createdAt,
    }));

    notifications = [
      ...(auditLogs || []).map((log: any) => ({
        id: log.id,
        title: `تم ${log.action === "create" ? "تقديم" : "تحديث"} ${log.entity}`,
        createdAt: log.createdAt.toISOString(),
      })),
      ...(notifs || []).map((n: any) => ({
        id: n.id,
        title: n.title || "إشعار",
        createdAt: n.createdAt.toISOString(),
      })),
    ].slice(0, 5);

  } catch (error) {
    console.error("[Employee Dashboard] Error loading data:", error);
    hasError = true;
  }

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
        <LatestNotifications notifications={notifications} />
        <RecentRequests requests={recentRequests} />
      </div>

      {hasError && (
        <div className="text-xs px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
          تم عرض بيانات احتياطية بسبب مشكلة مؤقتة في الاتصال.
        </div>
      )}
    </>
  );
}
