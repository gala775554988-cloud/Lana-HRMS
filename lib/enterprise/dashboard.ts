import { prisma } from "@/lib/prisma";
import { applyScopedWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";

export async function getEnterpriseDashboardMetrics(userId: string, roles: string[], dashboard: string) {
  const profile = await getAccessProfile(userId, roles);
  const employeeWhere = await applyScopedWhere("employees", {}, profile);
  const leaveWhere = await applyScopedWhere("leave-requests", { status: "PENDING" }, profile);
  const attendanceWhere = await applyScopedWhere("attendance", {}, profile);
  const documentsWhere = await applyScopedWhere("documents", {}, profile);
  const assetsWhere = await applyScopedWhere("assets", {}, profile);

  const [employees, pendingLeaves, attendanceRecords, documents, assets, pendingApprovals, unreadNotifications] = await Promise.all([
    prisma.employee.count({ where: employeeWhere }),
    prisma.leaveRequest.count({ where: leaveWhere as any }).catch(() => 0),
    prisma.attendanceRecord.count({ where: attendanceWhere as any }).catch(() => 0),
    prisma.employeeDocument.count({ where: documentsWhere as any }).catch(() => 0),
    prisma.asset.count({ where: assetsWhere as any }).catch(() => 0),
    prisma.workflowInstance.count({ where: { steps: { some: { approverUserId: userId, status: "PENDING" } } } }).catch(() => 0),
    prisma.notification.count({ where: { OR: [{ userId }, { userId: null }], readAt: null } }).catch(() => 0)
  ]);

  return {
    dashboard,
    employees,
    pendingLeaves,
    attendanceRecords,
    documents,
    assets,
    pendingApprovals,
    unreadNotifications
  };
}
