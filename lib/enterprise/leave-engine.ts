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
function proratedAccrual(annualLimit: number, serviceStart: Date, serviceEnd: Date | null, year: number) {
  const { start, end } = yearBounds(year);
  const activeFrom = serviceStart > start ? serviceStart : start;
  const activeTo = serviceEnd && serviceEnd < end ? serviceEnd : end;
  if (activeFrom > end || activeTo < start || activeTo < activeFrom) return 0;
  const totalDaysInYear = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const activeDays = Math.floor((activeTo.getTime() - activeFrom.getTime()) / 86_400_000) + 1;
  return round2(annualLimit * (activeDays / totalDaysInYear));
}

/** Gets (initializing on first read) an employee's per-type balance row for
 * a given year. Mirrors getEffectiveLeaveBalance's "never clamp to zero"
 * philosophy for `remaining`. On first read for a year, prorates accrual by
 * hire date and pulls forward whatever's left unused from the prior year's
 * row, capped at LeaveType.carryOverLimit -- this is the "auto balance
 * calculation" enterprise leave systems provide instead of a static number
 * an admin has to re-enter every year. */
export async function getOrInitLeaveTypeBalance(employeeId: string, leaveTypeId: string, year = new Date().getFullYear()): Promise<LeaveTypeBalanceRow> {
  const { start, end } = yearBounds(year);
  const [leaveType, employee, existing, approvedUsage] = await Promise.all([
    prisma.leaveType.findUniqueOrThrow({ where: { id: leaveTypeId } }),
    prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: {
        hireDate: true,
        firstContractDate: true,
        contracts: {
          where: { startDate: { lte: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] },
          orderBy: [{ status: "asc" }, { startDate: "desc" }],
          take: 1,
          select: { startDate: true, endDate: true }
        }
      }
    }),
    prisma.employeeLeaveTypeBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } } }),
    prisma.leaveRequest.aggregate({
      where: { employeeId, leaveTypeId, status: "APPROVED", startDate: { gte: start, lte: end } },
      _sum: { days: true }
    })
  ]);

  const contract = employee.contracts[0];
  const serviceStart = contract?.startDate ?? employee.firstContractDate ?? employee.hireDate;
  const serviceEnd = contract?.endDate ?? null;
  const accrued = proratedAccrual(leaveType.annualLimit ?? 0, serviceStart, serviceEnd, year);
  const used = Number(approvedUsage._sum.days ?? 0);

  if (existing) {
    const carriedOver = Number(existing.carriedOver);
    if (Number(existing.accrued) !== accrued || Number(existing.used) !== used) {
      await prisma.employeeLeaveTypeBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
        data: { accrued, used }
      });
    }
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

  const priorYear = await prisma.employeeLeaveTypeBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: year - 1 } }
  });
  let carriedOver = 0;
  if (priorYear && leaveType.carryOverLimit) {
    const priorRemaining = Number(priorYear.accrued) + Number(priorYear.carriedOver) - Number(priorYear.used);
    carriedOver = Math.max(0, Math.min(priorRemaining, leaveType.carryOverLimit));
  }

  await prisma.employeeLeaveTypeBalance.create({ data: { employeeId, leaveTypeId, year, accrued, used, carriedOver } });

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
export async function recordLeaveTypeApprovalUsage(employeeId: string, leaveTypeId: string, _days: number, startDate: Date) {
  const year = startDate.getFullYear();
  await getOrInitLeaveTypeBalance(employeeId, leaveTypeId, year);
  return prisma.employeeLeaveTypeBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } } });
}

/** Reverses a previously-recorded approval (e.g. an approved request is later
 * cancelled) -- symmetric with recordLeaveTypeApprovalUsage. */
export async function reverseLeaveTypeApprovalUsage(employeeId: string, leaveTypeId: string, _days: number, startDate: Date) {
  const year = startDate.getFullYear();
  await getOrInitLeaveTypeBalance(employeeId, leaveTypeId, year);
  return prisma.employeeLeaveTypeBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } } });
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
