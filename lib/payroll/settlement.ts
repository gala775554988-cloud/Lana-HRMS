import type { prisma } from "@/lib/prisma";
import type { PayrollBreakdown } from "@/lib/enterprise/payroll-engine";
import { money } from "./calculations";
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
    const changed = await tx.loan.updateMany({ where: { id: row.id, employeeId, status: "ACTIVE", outstandingAmount: row.outstanding }, data: { outstandingAmount: remaining, status: remaining === 0 ? "PAID" : "ACTIVE" } });
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
    if (!advance || advance.employeeId !== employeeId || advance.status !== "APPROVED" || advance.paidInstallments !== row.paidInstallments || row.amount <= 0 || money(Math.min(Number(advance.monthlyDeduction), Number(advance.amount) - Number(advance.monthlyDeduction) * advance.paidInstallments)) !== row.amount) throw new Error("تغير قسط السلفة بعد الاعتماد");
    const paid = advance.paidInstallments + 1;
    const changed = await tx.employeeSalaryAdvance.updateMany({ where: { id: row.id, paidInstallments: row.paidInstallments, status: "APPROVED" }, data: { paidInstallments: paid, status: paid >= advance.installments || money(Number(advance.amount) - Number(advance.monthlyDeduction) * paid) <= 0 ? "PAID" : "APPROVED" } });
    if (changed.count !== 1) throw new Error("تغيرت السلفة أثناء الصرف");
  }
}
