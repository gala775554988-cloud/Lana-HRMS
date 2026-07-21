import { prisma } from "@/lib/prisma";
import { getEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { calculateNetSalary } from "@/lib/employee/salary-profile";

/** Same hourly-rate convention as app/api/enterprise/overtime/route.ts
 * (calculateOvertimeAmount) -- kept identical so a request's estimated
 * amount at creation time matches what payroll actually pays. */
function overtimeMultiplier(type: string) {
  const normalized = (type || "").toLowerCase();
  if (normalized.includes("holiday") || normalized.includes("عطلة") || normalized.includes("weekend")) return 2;
  if (normalized.includes("night") || normalized.includes("ليل")) return 1.75;
  return 1.5;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export type PayrollBreakdown = {
  baseSalary: number;
  allowanceTotal: number;
  bonusTotal: number;
  overtimeTotal: number;
  grossPay: number;
  insuranceDeduction: number;
  taxTotal: number;
  loanDeduction: number;
  advanceDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  penaltyDeduction: number;
  otherDeductionTotal: number;
  deductionTotal: number;
  netPay: number;
  currency: string;
  overtimeRequestIds: string[];
  bonusIds: string[];
};

/** The single source of truth for "what does this employee earn". Reconciles
 * the three co-existing sources this codebase already has: the salary-profile
 * JSON (AppSetting-backed, written by the employee module form's quick
 * housing/transport/food/etc. fields), the relational Allowance table (used
 * by Odoo payslip-line sync and any HR-created recurring allowance), and
 * EmployeeContract.salaryAmount (fallback for employees never given a manual
 * salary profile at all). Profile wins for the base salary when present;
 * its own allowance sub-fields are added on top of (not instead of) real
 * Allowance rows -- an employee can have either, both, or neither. */
async function resolveBaseSalary(employeeId: string): Promise<{ base: number; currency: string; profileAllowanceTotal: number }> {
  const profile = await getEmployeeSalaryProfile(employeeId);
  const profileAllowanceTotal =
    (profile.salaryHousingAllowance ?? 0) +
    (profile.salaryTransportAllowance ?? 0) +
    (profile.salaryFoodAllowance ?? 0) +
    (profile.salaryCommunicationAllowance ?? 0) +
    (profile.salaryOtherAllowances ?? 0);
  const profileBase = calculateNetSalary(profile) > 0 ? profile.salaryBase ?? 0 : 0;
  if (profileBase > 0) return { base: profileBase, currency: "SAR", profileAllowanceTotal };

  const contract = await prisma.employeeContract.findFirst({
    where: { employeeId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: { salaryAmount: true, currency: true }
  });
  if (contract) return { base: Number(contract.salaryAmount), currency: contract.currency, profileAllowanceTotal };
  return { base: 0, currency: "SAR", profileAllowanceTotal };
}

/** Computes one employee's full payroll breakdown for a period, per the
 * formula: Gross = Basic + Allowances + Overtime + Bonuses/Commission;
 * Net = Gross - Insurance - Tax - Loans - Advances - Absence - Late -
 * Penalties. Every deduction source (insurance, loans, advances, attendance)
 * is read from its own existing table -- never duplicated into a new one --
 * so this function is purely a read+sum, safe to re-run (idempotent) until
 * `markPayrollSourcesConsumed` is called for a specific run. */
export async function computeEmployeePayroll(employeeId: string, periodStart: Date, periodEnd: Date): Promise<PayrollBreakdown> {
  const { base: baseSalary, currency, profileAllowanceTotal } = await resolveBaseSalary(employeeId);

  const [allowances, deductions, overtimeRequests, bonuses, socialInsurance, loans, advances, attendance] = await Promise.all([
    prisma.allowance.findMany({
      where: { employeeId, effectiveFrom: { lte: periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }] }
    }),
    prisma.deduction.findMany({
      where: { employeeId, effectiveFrom: { lte: periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }] }
    }),
    prisma.overtimeRequest.findMany({
      where: { employeeId, status: "APPROVED", workDate: { gte: periodStart, lte: periodEnd }, includedInPayrollAt: null }
    }),
    prisma.employeeBonus.findMany({
      where: { employeeId, status: "APPROVED", awardedDate: { gte: periodStart, lte: periodEnd }, includedInPayrollAt: null }
    }),
    prisma.socialInsuranceRecord.findUnique({ where: { employeeId }, select: { status: true, employeeContributionAmount: true } }),
    prisma.loan.findMany({ where: { employeeId, status: "ACTIVE" } }),
    prisma.employeeSalaryAdvance.findMany({ where: { employeeId, status: "APPROVED" } }),
    prisma.attendanceRecord.findMany({ where: { employeeId, workDate: { gte: periodStart, lte: periodEnd }, status: { in: ["ABSENT", "LATE", "HALF_DAY"] } }, select: { status: true } })
  ]);

  const allowanceTotal = round2(allowances.reduce((sum, a) => sum + Number(a.amount), 0) + profileAllowanceTotal);
  const taxTotal = round2(deductions.filter((d) => d.category === "TAX").reduce((sum, d) => sum + Number(d.amount), 0));
  const penaltyDeduction = round2(deductions.filter((d) => d.category === "PENALTY").reduce((sum, d) => sum + Number(d.amount), 0));
  const otherDeductionTotal = round2(
    deductions.filter((d) => d.category !== "TAX" && d.category !== "PENALTY").reduce((sum, d) => sum + Number(d.amount), 0)
  );

  const overtimeTotal = round2(
    overtimeRequests.reduce((sum, req) => {
      if (req.amount !== null && req.amount !== undefined) return sum + Number(req.amount);
      const hourlyRate = baseSalary > 0 ? baseSalary / 240 : 0;
      return sum + hourlyRate * Number(req.hours) * overtimeMultiplier(req.reason ?? "");
    }, 0)
  );

  const bonusTotal = round2(bonuses.reduce((sum, b) => sum + Number(b.amount), 0));

  const insuranceDeduction =
    socialInsurance && socialInsurance.status === "ACTIVE" ? round2(Number(socialInsurance.employeeContributionAmount)) : 0;

  const loanDeduction = round2(
    loans.reduce((sum, loan) => sum + Math.min(Number(loan.installmentAmount), Number(loan.outstandingAmount)), 0)
  );

  const advanceDeduction = round2(
    advances.reduce((sum, adv) => {
      const remaining = Number(adv.amount) - Number(adv.monthlyDeduction) * adv.paidInstallments;
      if (remaining <= 0 || adv.paidInstallments >= adv.installments) return sum;
      return sum + Math.min(Number(adv.monthlyDeduction), remaining);
    }, 0)
  );

  const dailyRate = baseSalary > 0 ? baseSalary / 30 : 0;
  const absenceDays = attendance.filter((a) => a.status === "ABSENT").length + attendance.filter((a) => a.status === "HALF_DAY").length * 0.5;
  const lateDays = attendance.filter((a) => a.status === "LATE").length;
  const absenceDeduction = round2(absenceDays * dailyRate);
  const lateDeduction = round2(lateDays * (dailyRate / 4));

  const grossPay = round2(baseSalary + allowanceTotal + overtimeTotal + bonusTotal);
  const deductionTotal = round2(
    insuranceDeduction + taxTotal + loanDeduction + advanceDeduction + absenceDeduction + lateDeduction + penaltyDeduction + otherDeductionTotal
  );
  const netPay = round2(grossPay - deductionTotal);

  return {
    baseSalary: round2(baseSalary),
    allowanceTotal,
    bonusTotal,
    overtimeTotal,
    grossPay,
    insuranceDeduction,
    taxTotal,
    loanDeduction,
    advanceDeduction,
    absenceDeduction,
    lateDeduction,
    penaltyDeduction,
    otherDeductionTotal,
    deductionTotal,
    netPay,
    currency,
    overtimeRequestIds: overtimeRequests.map((r) => r.id),
    bonusIds: bonuses.map((b) => b.id)
  };
}

/** Called exactly once, when a PayrollRun is actually paid (never on a
 * DRAFT compute/recompute) -- marks the overtime/bonus rows this breakdown
 * consumed so a later run never double-pays them, and decrements
 * loan/advance balances by what was actually deducted this run. */
export async function markPayrollSourcesConsumed(breakdown: PayrollBreakdown, employeeId: string) {
  const now = new Date();
  await Promise.all([
    breakdown.overtimeRequestIds.length
      ? prisma.overtimeRequest.updateMany({ where: { id: { in: breakdown.overtimeRequestIds } }, data: { includedInPayrollAt: now } })
      : Promise.resolve(),
    breakdown.bonusIds.length
      ? prisma.employeeBonus.updateMany({ where: { id: { in: breakdown.bonusIds } }, data: { includedInPayrollAt: now } })
      : Promise.resolve()
  ]);

  if (breakdown.loanDeduction > 0) {
    const loans = await prisma.loan.findMany({ where: { employeeId, status: "ACTIVE" } });
    for (const loan of loans) {
      const deducted = Math.min(Number(loan.installmentAmount), Number(loan.outstandingAmount));
      if (deducted <= 0) continue;
      const newOutstanding = round2(Number(loan.outstandingAmount) - deducted);
      await prisma.loan.update({
        where: { id: loan.id },
        data: { outstandingAmount: newOutstanding, status: newOutstanding <= 0 ? "PAID" : "ACTIVE" }
      });
    }
  }

  if (breakdown.advanceDeduction > 0) {
    const advances = await prisma.employeeSalaryAdvance.findMany({ where: { employeeId, status: "APPROVED" } });
    for (const adv of advances) {
      const remaining = Number(adv.amount) - Number(adv.monthlyDeduction) * adv.paidInstallments;
      if (remaining <= 0 || adv.paidInstallments >= adv.installments) continue;
      await prisma.employeeSalaryAdvance.update({
        where: { id: adv.id },
        data: {
          paidInstallments: adv.paidInstallments + 1,
          status: adv.paidInstallments + 1 >= adv.installments ? "PAID" : adv.status
        }
      });
    }
  }
}
