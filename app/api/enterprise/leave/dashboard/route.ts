import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewLeave } from "@/lib/enterprise/leave-permissions";
import { getAbsentEmployees } from "@/lib/enterprise/leave-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leave Dashboard summary: request counts by status, today's absentee
 * count, low/negative-balance employee count, upcoming approved leaves,
 * a per-type breakdown for the current year, and recent leave activity from
 * the existing audit log (both leaveRequest-entity entries like cancel, and
 * workflowInstance entries tagged type=LEAVE for submit/approve/reject). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewLeave(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));

  const [statusGroups, absentToday, upcomingRaw, typeBreakdownRaw, recentActivityRaw, balances] = await Promise.all([
    prisma.leaveRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    getAbsentEmployees(now),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { gte: now } },
      orderBy: { startDate: "asc" },
      take: 8,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        leaveType: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true, employeeNumber: true } }
      }
    }),
    prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: { createdAt: { gte: yearStart }, status: { in: ["APPROVED", "PENDING"] } },
      _count: { _all: true },
      _sum: { days: true }
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "leaveRequest" },
          { entity: "workflowInstance", metadata: { path: ["type"], equals: "LEAVE" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, entityId: true, createdAt: true, actor: { select: { name: true } } }
    }),
    prisma.employeeLeaveBalance.findMany({ select: { accrued: true, used: true } })
  ]);

  const statusCounts: Record<string, number> = { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
  for (const group of statusGroups) statusCounts[group.status] = group._count._all;

  const lowBalanceCount = balances.filter((b) => Number(b.accrued) - Number(b.used) < 3).length;

  const leaveTypeIds = typeBreakdownRaw.map((t) => t.leaveTypeId);
  const leaveTypes = leaveTypeIds.length
    ? await prisma.leaveType.findMany({ where: { id: { in: leaveTypeIds } }, select: { id: true, name: true } })
    : [];
  const typeById = new Map(leaveTypes.map((t) => [t.id, t.name]));
  const typeBreakdown = typeBreakdownRaw
    .map((t) => ({ name: typeById.get(t.leaveTypeId) ?? "غير معروف", requestCount: t._count._all, totalDays: Number(t._sum.days ?? 0) }))
    .sort((a, b) => b.totalDays - a.totalDays);

  const upcoming = upcomingRaw.map((leave) => ({
    id: leave.id,
    employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`,
    employeeNumber: leave.employee.employeeNumber,
    leaveTypeName: leave.leaveType.name,
    startDate: leave.startDate,
    endDate: leave.endDate
  }));

  const recentActivity = recentActivityRaw.map((log) => ({
    id: log.id,
    action: log.action,
    requestId: log.entityId,
    actorName: log.actor?.name ?? "النظام",
    createdAt: log.createdAt
  }));

  return NextResponse.json({
    success: true,
    statusCounts,
    absentToday: absentToday.length,
    lowBalanceCount,
    upcoming,
    typeBreakdown,
    recentActivity
  });
}
