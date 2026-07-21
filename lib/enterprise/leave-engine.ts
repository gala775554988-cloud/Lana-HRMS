import { prisma } from "@/lib/prisma";

export type LeaveTypeBalanceRow = {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  isPaid: boolean;
  accrued: number;
  used: number;
  carriedOver: number;
  remaining: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function yearBounds(year: number) {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) };
}

/** A hire-year employee only accrues their share of the year remaining
 * after their hire date -- full annualLimit would over-grant someone hired
 * in November. Every later year gets the full annualLimit. */
function proratedAccrual(annualLimit: number, hireDate: Date, year: number) {
  const { start, end } = yearBounds(year);
  if (hireDate <= start) return annualLimit;
  if (hireDate > end) return 0;
  const totalDaysInYear = (end.getTime() - start.getTime()) / 86_400_000;
  const daysEmployedThisYear = (end.getTime() - hireDate.getTime()) / 86_400_000;
  return round2(annualLimit * (daysEmployedThisYear / totalDaysInYear));
}

/** Gets (initializing on first read) an employee's per-type balance row for
 * a given year. Mirrors getEffectiveLeaveBalance's "never clamp to zero"
 * philosophy for `remaining`. On first read for a year, prorates accrual by
 * hire date and pulls forward whatever's left unused from the prior year's
 * row, capped at LeaveType.carryOverLimit -- this is the "auto balance
 * calculation" enterprise leave systems provide instead of a static number
 * an admin has to re-enter every year. */
export async function getOrInitLeaveTypeBalance(employeeId: string, leaveTypeId: string, year = new Date().getFullYear()): Promise<LeaveTypeBalanceRow> {
  const [leaveType, employee, existing] = await Promise.all([
    prisma.leaveType.findUniqueOrThrow({ where: { id: leaveTypeId } }),
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { hireDate: true } }),
    prisma.employeeLeaveTypeBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } } })
  ]);

  if (existing) {
    const accrued = Number(existing.accrued);
    const used = Number(existing.used);
    const carriedOver = Number(existing.carriedOver);
    return {
      leaveTypeId,
      leaveTypeName: leaveType.name,
      leaveTypeCode: leaveType.code,
      isPaid: leaveType.isPaid,
      accrued,
      used,
      carriedOver,
      remaining: round2(accrued + carriedOver - used)
    };
  }

  const annualLimit = leaveType.annualLimit ?? 0;
  const accrued = proratedAccrual(annualLimit, employee.hireDate, year);

  const priorYear = await prisma.employeeLeaveTypeBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: year - 1 } }
  });
  let carriedOver = 0;
  if (priorYear && leaveType.carryOverLimit) {
    const priorRemaining = Number(priorYear.accrued) + Number(priorYear.carriedOver) - Number(priorYear.used);
    carriedOver = Math.max(0, Math.min(priorRemaining, leaveType.carryOverLimit));
  }

  await prisma.employeeLeaveTypeBalance.create({ data: { employeeId, leaveTypeId, year, accrued, used: 0, carriedOver } });

  return {
    leaveTypeId,
    leaveTypeName: leaveType.name,
    leaveTypeCode: leaveType.code,
    isPaid: leaveType.isPaid,
    accrued,
    used: 0,
    carriedOver,
    remaining: round2(accrued + carriedOver)
  };
}

/** Every active LeaveType's balance for one employee, for the year the given
 * date falls in -- what the balance cards / dashboard render. */
export async function getAllLeaveTypeBalances(employeeId: string, forDate = new Date()): Promise<LeaveTypeBalanceRow[]> {
  const year = forDate.getFullYear();
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true } });
  return Promise.all(leaveTypes.map((type) => getOrInitLeaveTypeBalance(employeeId, type.id, year)));
}

/** Called once a LEAVE workflow reaches APPROVED (alongside the existing
 * aggregate recordLeaveApprovalUsage, which keeps running unchanged for
 * anything still reading only the old aggregate). Increments `used` on the
 * per-type/per-year row for the year the leave actually starts in. */
export async function recordLeaveTypeApprovalUsage(employeeId: string, leaveTypeId: string, days: number, startDate: Date) {
  const year = startDate.getFullYear();
  await getOrInitLeaveTypeBalance(employeeId, leaveTypeId, year);
  return prisma.employeeLeaveTypeBalance.update({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    data: { used: { increment: days } }
  });
}

/** Reverses a previously-recorded approval (e.g. an approved request is later
 * cancelled) -- symmetric with recordLeaveTypeApprovalUsage. */
export async function reverseLeaveTypeApprovalUsage(employeeId: string, leaveTypeId: string, days: number, startDate: Date) {
  const year = startDate.getFullYear();
  const existing = await prisma.employeeLeaveTypeBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } } });
  if (!existing) return null;
  return prisma.employeeLeaveTypeBalance.update({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    data: { used: { decrement: days } }
  });
}

/** True if this employee already has a PENDING or APPROVED leave request
 * overlapping [startDate, endDate] -- a hard data-integrity check (an
 * employee can't be on two overlapping leaves), not a soft policy warning.
 * `excludeRequestId` lets a request being edited ignore itself. */
export async function detectLeaveConflict(employeeId: string, startDate: Date, endDate: Date, excludeRequestId?: string) {
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      id: excludeRequestId ? { not: excludeRequestId } : undefined,
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: { id: true, startDate: true, endDate: true, leaveType: { select: { name: true } } }
  });
  return overlapping;
}

/** Informational (never blocking) heads-up for approvers: how many other
 * employees in the same department already have overlapping approved/pending
 * leave, so a manager can see a staffing gap before approving. */
export async function countDepartmentOverlap(employeeId: string, startDate: Date, endDate: Date) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
  if (!employee?.departmentId) return 0;
  return prisma.leaveRequest.count({
    where: {
      employeeId: { not: employeeId },
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      employee: { departmentId: employee.departmentId }
    }
  });
}

/** Employees on APPROVED leave covering a given date -- the absentee report. */
export async function getAbsentEmployees(date: Date, filters?: { departmentId?: string; branchId?: string }) {
  return prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
      employee: {
        ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters?.branchId ? { branchId: filters.branchId } : {})
      }
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      leaveType: { select: { name: true, code: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          department: { select: { name: true } },
          branch: { select: { name: true } }
        }
      }
    },
    orderBy: { employee: { firstName: "asc" } }
  });
}
