import { prisma } from "@/lib/prisma";

export type LeaveBalanceSnapshot = {
  accrued: number;
  used: number;
  remaining: number;
};

/**
 * Effective leave balance for one employee. EmployeeLeaveBalance (the
 * structured, admin-editable table) takes priority once it exists; older
 * employees who were only ever CSV-imported (Employee.odooRawData._csvLeaveData)
 * fall back to that snapshot so their historical numbers don't reset to the
 * default 30 the moment this table shipped. remaining is intentionally not
 * clamped to zero -- a real overdraft must show as a negative number.
 */
export async function getEffectiveLeaveBalance(employeeId: string): Promise<LeaveBalanceSnapshot> {
  const balance = await prisma.employeeLeaveBalance.findUnique({ where: { employeeId } });
  if (balance) {
    const accrued = Number(balance.accrued);
    const used = Number(balance.used);
    return { accrued, used, remaining: accrued - used };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { odooRawData: true } });
  const raw = (employee?.odooRawData as any) || {};
  const csv = raw._csvLeaveData || {};
  const accrued = Number(csv.daysAccrued ?? raw.leaveBalance ?? 30);
  const used = typeof csv.daysUsed === "number" || typeof raw.leaveUsed === "number" ? Number(csv.daysUsed ?? raw.leaveUsed) : 0;
  return { accrued, used, remaining: accrued - used };
}

/**
 * Admin-facing direct edit of the total entitlement (`accrued`). `used`
 * stays system-managed via recordLeaveApprovalUsage below -- this never
 * touches it, so a manual correction to the entitlement can't accidentally
 * erase real usage history.
 */
export async function setEmployeeLeaveAccrued(employeeId: string, accrued: number) {
  const existing = await prisma.employeeLeaveBalance.findUnique({ where: { employeeId } });
  if (existing) {
    return prisma.employeeLeaveBalance.update({ where: { employeeId }, data: { accrued } });
  }
  const seed = await getEffectiveLeaveBalance(employeeId);
  return prisma.employeeLeaveBalance.create({ data: { employeeId, accrued, used: seed.used } });
}

/**
 * Called once a LEAVE workflow reaches APPROVED (see decideWorkflowStep).
 * Upserts the balance row (seeding accrued/used from the CSV snapshot on
 * first touch, exactly like getEffectiveLeaveBalance would) and adds this
 * request's days to `used`.
 */
export async function recordLeaveApprovalUsage(employeeId: string, days: number) {
  const existing = await prisma.employeeLeaveBalance.findUnique({ where: { employeeId } });
  if (existing) {
    return prisma.employeeLeaveBalance.update({ where: { employeeId }, data: { used: { increment: days } } });
  }
  const seed = await getEffectiveLeaveBalance(employeeId);
  return prisma.employeeLeaveBalance.create({ data: { employeeId, accrued: seed.accrued, used: seed.used + days } });
}
