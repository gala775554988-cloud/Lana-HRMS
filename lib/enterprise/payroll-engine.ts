import { calculateGosi, resolveGosiCohort } from "@/lib/payroll/calculations";
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

function timeToMinutes(value?: string | null) {
  const [hours, minutes] = String(value || "09:00").split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 9) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function riyadhMinutes(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value || 0);
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
  oneOffSourceKeys: string[];
  components: { code: string; name: string; kind: string; amount: number; sourceId?: string }[];
  gosi: ReturnType<typeof calculateGosi>;
  loanAllocations: { id: string; amount: number; outstanding: number; installmentIds?: string[] }[];
  advanceAllocations: { id: string; amount: number; paidInstallments: number }[];
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
async function payrollProfile(employeeId:string){
  const stored=await prisma.appSetting.findUnique({where:{key:`odoo.compensation.${employeeId}`},select:{value:true}});
  const source=stored?.value as {profile?:Awaited<ReturnType<typeof getEmployeeSalaryProfile>>;currency?:string}|null;
  return {profile:source?.profile??await getEmployeeSalaryProfile(employeeId),currency:source?.currency,odoo:!!source?.profile};
}
async function resolveBaseSalary(employeeId: string): Promise<{ base: number; currency: string; profileAllowanceTotal: number }> {
  const {profile,currency:sourceCurrency} = await payrollProfile(employeeId);
  const profileAllowanceTotal =
    (profile.salaryHousingAllowance ?? 0) +
    (profile.salaryTransportAllowance ?? 0) +
    (profile.salaryFoodAllowance ?? 0) +
    (profile.salaryCommunicationAllowance ?? 0) +
    (profile.salaryOtherAllowances ?? 0);
  const profileBase = calculateNetSalary(profile) > 0 ? profile.salaryBase ?? 0 : 0;
  if (profileBase > 0) return { base: profileBase, currency: sourceCurrency ?? "SAR", profileAllowanceTotal };

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

  const [allAllowances, allDeductions, overtimeRequests, bonuses, socialInsurance, loans, advances, attendance] = await Promise.all([
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
    prisma.socialInsuranceRecord.findUnique({ where: { employeeId }, select: { status: true, employeeContributionAmount: true, coverageCohort: true, firstCoverageDate: true } }),
    prisma.loan.findMany({ where: { employeeId, status: "ACTIVE", issuedAt: { lte: periodEnd } }, include: { repaymentSchedule: { where: { dueDate: { gte: periodStart, lte: periodEnd }, remotePaid: false, localPaidAt: null }, orderBy: { dueDate: "asc" } } } }),
    prisma.employeeSalaryAdvance.findMany({ where: { employeeId, status: "APPROVED", startDate: { lte: periodEnd } } }),
    prisma.attendanceRecord.findMany({
      where: { employeeId, workDate: { gte: periodStart, lte: periodEnd }, status: { in: ["ABSENT", "LATE", "HALF_DAY"] } },
      select: {
        status: true,
        workDate: true,
        checkIn: true,
        employee: {
          select: {
            shiftAssignments: {
              where: { isActive: true },
              orderBy: { effectiveFrom: "desc" },
              include: { shift: { select: { startTime: true } } }
            }
          }
        }
      }
    })
  ]);

  const oneOffKeys = [...allAllowances.filter(row => !row.isRecurring).map(row => `payroll.once.allowance.${row.id}`), ...allDeductions.filter(row => !row.isRecurring).map(row => `payroll.once.deduction.${row.id}`)];
  const consumed = new Set((await prisma.appSetting.findMany({ where: { key: { in: oneOffKeys } }, select: { key: true } })).map(row => row.key));
  const allowances = allAllowances.filter(row => row.isRecurring || !consumed.has(`payroll.once.allowance.${row.id}`));
  const deductions = allDeductions.filter(row => row.isRecurring || !consumed.has(`payroll.once.deduction.${row.id}`));
  const oneOffSourceKeys = oneOffKeys.filter(key => !consumed.has(key));
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

  const [employee, policies, profile] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { nationality: { select: { code: true } } } }),
    prisma.gosiSetting.findMany({ where: { effectiveFrom: { lte: periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }] } }),
    payrollProfile(employeeId).then(result=>result.profile),
  ]);
  const saudi = ["SA", "SAU", "SAUDI"].includes(employee.nationality?.code.toUpperCase() ?? "");
  const active = socialInsurance?.status === "ACTIVE";
  if (active && !employee.nationality?.code) throw new Error("حدد جنسية الموظف قبل احتساب التأمينات");
  const cutoffs = [...new Set(policies.map(policy => policy.newSystemCutoff?.toISOString()).filter((value): value is string => Boolean(value)))];
  if (cutoffs.length > 1) throw new Error("تواريخ فصل نظام التأمينات متعارضة؛ راجع السياسات");
  const cutoff = cutoffs.length ? new Date(cutoffs[0]) : null;
  const cohort = saudi && active ? resolveGosiCohort(socialInsurance?.coverageCohort ?? null, socialInsurance?.firstCoverageDate ?? null, cutoff) : "";
  const gosi = calculateGosi({ saudi, active, cohort, asOf: periodEnd, basic: baseSalary,
    housing: Number(profile.salaryHousingAllowance ?? 0) + allowances.filter(row => row.category.toUpperCase() === "HOUSING").reduce((sum, row) => sum + Number(row.amount), 0),
    policies: policies.map(policy => ({ ...policy, employeeRate: Number(policy.employeeRate), employerRate: Number(policy.employerRate), minimumWage: Number(policy.minimumWage), maximumWage: Number(policy.maximumWage) })),
  });
  const insuranceDeduction = gosi.employeeAmount;

  const loanAllocations = loans.map(loan => {
    if (loan.currency !== currency) throw new Error("عملة السلفة لا تطابق عملة الراتب؛ يلزم تحويل معتمد قبل الخصم");
    const scheduled = loan.repaymentSchedule.reduce((sum, row) => sum + Number(row.amount), 0);
    if (loan.odooSource && scheduled > Number(loan.outstandingAmount) + 0.005) throw new Error("جدول الأقساط المستحقة يتجاوز رصيد السلفة");
    return { id: loan.id, amount: round2(loan.odooSource ? scheduled : Math.min(Number(loan.installmentAmount), Number(loan.outstandingAmount))), outstanding: Number(loan.outstandingAmount), ...(loan.odooSource ? { installmentIds: loan.repaymentSchedule.map(row => row.id) } : {}) };
  }).filter(row => row.amount > 0);
  const loanDeduction = round2(loanAllocations.reduce((sum, row) => sum + row.amount, 0));

  const advanceDeduction = round2(
    advances.reduce((sum, adv) => {
      const remaining = Number(adv.amount) - Number(adv.monthlyDeduction) * adv.paidInstallments;
      if (remaining <= 0 || adv.paidInstallments >= adv.installments) return sum;
      return sum + Math.min(Number(adv.monthlyDeduction), remaining);
    }, 0)
  );

  const dailyRate = baseSalary > 0 ? baseSalary / 30 : 0;
  const absenceDays = attendance.filter((a) => a.status === "ABSENT").length + attendance.filter((a) => a.status === "HALF_DAY").length * 0.5;
  const absenceDeduction = round2(absenceDays * dailyRate);
  const hourlyRate = baseSalary > 0 ? baseSalary / 240 : 0;
  const lateDeduction = round2(attendance.filter((row) => row.status === "LATE").reduce((sum, row) => {
    if (!row.checkIn) return sum + dailyRate / 4;
    const assignment = row.employee.shiftAssignments.find((item) => item.effectiveFrom <= row.workDate && (!item.effectiveTo || item.effectiveTo >= row.workDate));
    const lateMinutes = Math.max(0, riyadhMinutes(row.checkIn) - timeToMinutes(assignment?.shift.startTime));
    return sum + Math.min(dailyRate, hourlyRate * (lateMinutes / 60));
  }, 0));

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
    bonusIds: bonuses.map((b) => b.id),
    gosi,
    oneOffSourceKeys,
    components: [
      { code: "BASIC", name: "الراتب الأساسي", kind: "EARNING", amount: baseSalary },
      ...[["HOUSING", "بدل السكن", profile.salaryHousingAllowance], ["TRANSPORT", "بدل الانتقال", profile.salaryTransportAllowance], ["FOOD", "بدل الطعام", profile.salaryFoodAllowance], ["COMMUNICATION", "بدل الاتصال", profile.salaryCommunicationAllowance], ["OTHER", "بدلات أخرى", profile.salaryOtherAllowances]].map(([code, name, amount]) => ({ code: String(code), name: String(name), kind: "EARNING", amount: Number(amount ?? 0) })),
      ...allowances.map(row => ({ code: row.category, name: row.name, kind: "EARNING", amount: Number(row.amount), sourceId: row.id })),
      ...deductions.map(row => ({ code: row.category, name: row.name, kind: "DEDUCTION", amount: Number(row.amount), sourceId: row.id })),
      ...overtimeRequests.map(row => ({ code: "OVERTIME", name: row.reason ?? "عمل إضافي", kind: "EARNING", amount: Number(row.amount ?? baseSalary / 240 * Number(row.hours) * overtimeMultiplier(row.reason ?? "")), sourceId: row.id })),
      ...bonuses.map(row => ({ code: "BONUS", name: "مكافأة", kind: "EARNING", amount: Number(row.amount), sourceId: row.id })),
      { code: "GOSI", name: "تأمينات الموظف", kind: "DEDUCTION", amount: insuranceDeduction },
      { code: "ABSENCE", name: "الغياب", kind: "DEDUCTION", amount: absenceDeduction },
      { code: "LATE", name: "التأخير", kind: "DEDUCTION", amount: lateDeduction },
      { code: "LOAN", name: "أقساط القروض", kind: "DEDUCTION", amount: loanDeduction },
      { code: "ADVANCE", name: "أقساط السلف", kind: "DEDUCTION", amount: advanceDeduction },
    ].filter(row => row.amount !== 0),
    loanAllocations,
    advanceAllocations: advances.filter(row => row.paidInstallments < row.installments).map(row => ({ id: row.id, amount: round2(Math.min(Number(row.monthlyDeduction), Number(row.amount) - Number(row.monthlyDeduction) * row.paidInstallments)), paidInstallments: row.paidInstallments })).filter(row => row.amount > 0),
  };
}

export type RunEmployeeScope = {
  employeeIds?: string[];
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  costCenterId?: string;
};

/** Shared by every place that needs to (re)compute a run's PayrollItems for
 * its matched employees -- initial creation (run/route.ts), Recalculate, and
 * Duplicate. Upserts rather than replaces, so calling it again on the same
 * run is always safe (matches the existing "DRAFT may be recomputed many
 * times" invariant) -- never marks anything consumed, that only ever
 * happens once, at pay time (see markPayrollSourcesConsumed above). */
export async function computeAndUpsertPayrollItems(
  runId: string, periodStartDate: Date, periodEndDate: Date, scope: RunEmployeeScope
) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
  if (!["DRAFT", "PROCESSING"].includes(run.status)) throw new Error("المسير معتمد أو مقفل");
  if (await prisma.payrollItem.count({ where: { payrollRunId: runId, odooPayslipId: { not: null } } })) throw new Error("مسير مستورد من Odoo؛ حدّثه من كشوف Odoo بدلاً من إعادة احتسابه محلياً");
  const employeeWhere: Record<string, unknown> = { status: "ACTIVE" };
  if (scope.employeeIds?.length) employeeWhere.id = { in: scope.employeeIds };
  if (scope.companyId) employeeWhere.companyId = scope.companyId;
  if (scope.branchId) employeeWhere.branchId = scope.branchId;
  if (scope.departmentId) employeeWhere.departmentId = scope.departmentId;
  const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true } });
  const items: Array<{ employeeId: string; netPay: number; error?: string }> = [];
  const calculated: Array<{ employeeId: string; breakdown: PayrollBreakdown }> = [];
  for (const employee of employees) {
    try {
      const breakdown = await computeEmployeePayroll(employee.id, periodStartDate, periodEndDate);
      calculated.push({ employeeId: employee.id, breakdown });
      items.push({ employeeId: employee.id, netPay: breakdown.netPay });
    } catch (error) { items.push({ employeeId: employee.id, netPay: 0, error: error instanceof Error ? error.message : "تعذر الاحتساب" }); }
  }
  const errorCount = items.filter(item => item.error).length;
  await prisma.$transaction(async tx => {
    const editable = await tx.payrollRun.updateMany({ where: { id: runId, status: run.status, updatedAt: run.updatedAt }, data: { updatedAt: new Date() } });
    if (editable.count !== 1) throw new Error("تغير المسير أثناء الاحتساب؛ أعد المحاولة");
    const summary = { employeeCount: employees.length, errorCount, errors: items.filter(item => item.error).map(item => ({ employeeId: item.employeeId, error: item.error! })) };
    await tx.appSetting.upsert({ where: { key: `payroll.compute.${runId}` }, create: { key: `payroll.compute.${runId}`, value: summary }, update: { value: summary } });
    if (errorCount) return; // Never publish a partial calculation over a valid draft.
    for (const { employeeId, breakdown } of calculated) {
      const data = {
        calculationSnapshot: JSON.parse(JSON.stringify(breakdown)), employerInsurance: breakdown.gosi.employerAmount,
        baseSalary: breakdown.baseSalary, allowanceTotal: breakdown.allowanceTotal, bonusTotal: breakdown.bonusTotal,
        overtimeTotal: breakdown.overtimeTotal, grossPay: breakdown.grossPay, insuranceDeduction: breakdown.insuranceDeduction,
        taxTotal: breakdown.taxTotal, loanDeduction: breakdown.loanDeduction, advanceDeduction: breakdown.advanceDeduction,
        absenceDeduction: breakdown.absenceDeduction, lateDeduction: breakdown.lateDeduction, penaltyDeduction: breakdown.penaltyDeduction,
        deductionTotal: breakdown.deductionTotal, netPay: breakdown.netPay, currency: breakdown.currency, costCenterId: scope.costCenterId,
      };
      await tx.payrollItem.upsert({ where: { payrollRunId_employeeId: { payrollRunId: runId, employeeId } }, update: data, create: { ...data, payrollRunId: runId, employeeId } });
    }
    // A changed employee selection must not retain stale employees in a draft.
    await tx.payrollItem.deleteMany({ where: { payrollRunId: runId, employeeId: { notIn: calculated.map(row => row.employeeId) } } });
  }, { timeout: 30000 });
  return { employeeCount: employees.length, items, errorCount };
}
