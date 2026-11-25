import type { prisma } from "@/lib/prisma";
import type { PayrollBreakdown } from "@/lib/enterprise/payroll-engine";
import { money, advanceSchedule } from "./calculations";
type Transaction = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
export async function consumeApprovedPayroll(tx: Transaction, snapshot: PayrollBreakdown, employeeId: string, now: Date) {
  if (!snapshot || !Array.isArray(snapshot.loanAllocations) || !Array.isArray(snapshot.advanceAllocations) || !Array.isArray(snapshot.overtimeRequestIds) || !Array.isArray(snapshot.bonusIds)) throw new Error("أعد احتساب المسير قبل اعتماده؛ لقطة المصادر مفقودة");
  for (const key of snapshot.oneOffSourceKeys ?? []) {
    if (!/^payroll\.once\.(allowance|deduction)\.[A-Za-z0-9_-]+$/.test(key)) throw new Error("مرجع مصدر مالي غير صالح");
    await tx.appSetting.create({ data: { key, value: { employeeId, consumedAt: now.toISOString() } } });
  }
  if (snapshot.overtimeRequestIds.length) {
    const changed = await tx.overtimeRequest.updateMany({ where: { id: { in: snapshot.overtimeRequestIds }, employeeId, status: "APPROVED", includedInPayrollAt: null }, data: { includedInPayrollAt: now } });
    if (changed.count !== snapshot.overtimeRequestIds.length) throw new Error("تغيرت مصادر العمل الإضافي؛ يلزم مراجعة المسير");
  }
  if (snapshot.bonusIds.length) {
    const changed = await tx.employeeBonus.updateMany({ where: { id: { in: snapshot.bonusIds }, employeeId, status: "APPROVED", includedInPayrollAt: null }, data: { includedInPayrollAt: now } });
    if (changed.count !== snapshot.bonusIds.length) throw new Error("سبق صرف بعض المكافآت");
  }
  for (const row of snapshot.loanAllocations) {
    const remaining = money(row.outstanding - row.amount);
    if (!Number.isFinite(remaining) || remaining < 0 || row.amount <= 0) throw new Error("قسط غير صالح");
    const changed = await tx.loan.updateMany({ where: { id: row.id, employeeId, status: "ACTIVE", outstandingAmount: row.outstanding, OR:[{disbursementRequired:false},{disbursedAt:{not:null}}] }, data: { outstandingAmount: remaining, status: remaining === 0 ? "PAID" : "ACTIVE" } });
    if (changed.count !== 1) throw new Error("تغير رصيد القرض بعد الاعتماد؛ يلزم مراجعة المسير");
    if (row.installmentIds?.length) {
      const installments = await tx.odooLoanInstallment.findMany({ where: { id: { in: row.installmentIds }, loanId: row.id, remotePaid: false, localPaidAt: null } });
      if (installments.length !== row.installmentIds.length || money(installments.reduce((sum, installment) => sum + Number(installment.amount), 0)) !== row.amount) throw new Error("تغيرت أقساط Odoo بعد اعتماد المسير");
      const consumed = await tx.odooLoanInstallment.updateMany({ where: { id: { in: row.installmentIds }, remotePaid: false, localPaidAt: null }, data: { localPaidAt: now } });
      if (consumed.count !== row.installmentIds.length) throw new Error("سبق استهلاك بعض أقساط السلفة");
    }
  }
  for (const row of snapshot.advanceAllocations) {
    const advance = await tx.employeeSalaryAdvance.findUnique({ where: { id: row.id } });
    if (!advance || advance.employeeId !== employeeId || advance.status !== "APPROVED" || (advance.disbursementRequired&&!advance.disbursedAt) || advance.paidInstallments !== row.paidInstallments || row.amount <= 0) throw new Error("تغير قسط السلفة بعد الاعتماد");
    const schedule = advanceSchedule({ amount: Number(advance.amount), monthlyDeduction: Number(advance.monthlyDeduction), installments: advance.installments, paidInstallments: advance.paidInstallments });
    if (schedule.next !== row.amount) throw new Error("تغير قسط السلفة بعد الاعتماد؛ أعد احتساب المسير");
    const paid = advance.paidInstallments + 1;
    const changed = await tx.employeeSalaryAdvance.updateMany({ where: { id: row.id, employeeId, paidInstallments: row.paidInstallments, status: "APPROVED", amount: advance.amount, monthlyDeduction: advance.monthlyDeduction, installments: advance.installments }, data: { paidInstallments: paid, status: schedule.completeAfterNext ? "PAID" : "APPROVED" } });
    if (changed.count !== 1) throw new Error("تغيرت السلفة أثناء الصرف");
  }
}

/** One set of detailed ledger postings, not additional postings on top of the
 * gross/deduction totals. The frozen payroll snapshot is reconciled in halalas. */
export function buildPayrollLedgerBreakdown(snapshot: PayrollBreakdown) {
  const cents = (value: number) => {
    const amount = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount)) throw new Error("بند مالي غير صالح");
    return amount;
  };
  const rows: { effectType: string; direction: "CREDIT" | "DEBIT"; amount: number; sourceId?: string }[] = [];
  const add = (effectType: string, direction: "CREDIT" | "DEBIT", value: number, sourceId?: string) => {
    const amount = cents(value);
    if (amount) rows.push({ effectType, direction, amount: amount / 100, ...(sourceId ? { sourceId } : {}) });
  };
  add("BASIC", "CREDIT", snapshot.baseSalary);
  add("ALLOWANCES", "CREDIT", snapshot.allowanceTotal);
  add("BONUS", "CREDIT", snapshot.bonusTotal);
  add("OVERTIME", "CREDIT", snapshot.overtimeTotal);
  add("GOSI", "DEBIT", snapshot.insuranceDeduction);
  add("TAX", "DEBIT", snapshot.taxTotal);
  add("ABSENCE", "DEBIT", snapshot.absenceDeduction);
  add("LEAVE_DEDUCTION","DEBIT",snapshot.leaveDeduction??0);
  add("LATE", "DEBIT", snapshot.lateDeduction);
  add("PENALTY", "DEBIT", snapshot.penaltyDeduction);
  add("OTHER_DEDUCTIONS", "DEBIT", snapshot.otherDeductionTotal);
  for (const [kind, allocations, total] of [
    ["LOAN", snapshot.loanAllocations, snapshot.loanDeduction],
    ["ADVANCE", snapshot.advanceAllocations, snapshot.advanceDeduction]
  ] as const) {
    if (!Array.isArray(allocations) || new Set(allocations.map(row => row.id)).size !== allocations.length ||
        allocations.reduce((sum, row) => sum + cents(row.amount), 0) !== cents(total)) throw new Error("أقساط المسير لا تتطابق مع اللقطة المعتمدة");
    for (const row of allocations) {
      if (!row.id) throw new Error("مرجع قسط غير صالح");
      add(kind + ":" + row.id, "DEBIT", row.amount, row.id);
    }
  }
  const total = (direction: "CREDIT" | "DEBIT") => rows.filter(row => row.direction === direction).reduce((sum,row) => sum + cents(row.amount), 0);
  if (total("CREDIT") !== cents(snapshot.grossPay) || total("DEBIT") !== cents(snapshot.deductionTotal) ||
      total("CREDIT") - total("DEBIT") !== cents(snapshot.netPay)) throw new Error("تفاصيل القيود لا تتطابق مع صافي المسير المعتمد");
  return rows;
}
