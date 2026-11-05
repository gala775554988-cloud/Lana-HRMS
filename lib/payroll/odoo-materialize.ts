import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { money } from "./calculations";
export function classifyOdooLines(lines: { code: unknown; name?: unknown; total: unknown }[], mapping: Map<string, string>) {
  const components = lines.map(line => {
    const code = String(line.code); const kind = mapping.get(code) ?? ({ BASIC: "BASIC", GROSS: "GROSS", NET: "NET" } as Record<string, string>)[code];
    const total = Number(line.total);
    if (!kind || !Number.isFinite(total)) throw new Error(`حدد قاعدة راتب للبند ${code}`);
    return { code, name: String(line.name ?? code), kind, amount: money(total) };
  });
  const only = (kind: string) => { const found = components.filter(row => row.kind === kind); if (found.length !== 1) throw new Error(`يجب وجود بند ${kind} واحد`); return found[0].amount; };
  const baseSalary = only("BASIC"), grossPay = only("GROSS"), netPay = only("NET");
  const allowanceTotal = money(components.filter(row => row.kind === "ALLOWANCE").reduce((sum, row) => sum + row.amount, 0));
  const deductionTotal = money(components.filter(row => row.kind === "DEDUCTION").reduce((sum, row) => sum + Math.abs(row.amount), 0));
  if (Math.abs(grossPay - baseSalary - allowanceTotal) > 0.01 || Math.abs(grossPay - deductionTotal - netPay) > 0.01) throw new Error("بنود كشف Odoo لا تتطابق مع الإجمالي والصافي؛ راجع تصنيف القواعد");
  return { components, baseSalary, grossPay, netPay, allowanceTotal, deductionTotal };
}
export async function materializeOdooSnapshot(snapshotId: string, runId: string, actorUserId: string) {
  return prisma.$transaction(async tx => {
    const snapshot = await tx.odooPayrollSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
    if (!["DRAFT", "PROCESSING"].includes(run.status) || run.period !== snapshot.period) throw new Error("اختر مسودة مسير للفترة نفسها");
    const employee = await tx.employee.findUniqueOrThrow({ where: { id: snapshot.employeeId }, select: { companyId: true, branchId: true, departmentId: true } });
    if ((run.companyId && run.companyId !== employee.companyId) || (run.branchId && run.branchId !== employee.branchId) || (run.departmentId && run.departmentId !== employee.departmentId)) throw new Error("الموظف خارج نطاق المسير");
    const claimed = await tx.payrollRun.updateMany({ where: { id: run.id, status: run.status, updatedAt: run.updatedAt }, data: { updatedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("تغير المسير أثناء الاستيراد");
    const rules = await tx.salaryRule.findMany({ where: { isActive: true } });
    const totals = classifyOdooLines(snapshot.lines as { code: unknown; name?: unknown; total: unknown }[], new Map(rules.map(rule => [rule.code, rule.category])));
    const calculated = { ...totals, origin: "ODOO", source: snapshot.source, sourceSnapshotId: snapshot.id, currency: snapshot.currency, oneOffSourceKeys: [], loanAllocations: [], advanceAllocations: [], overtimeRequestIds: [], bonusIds: [], gosi: { applicable: false, policyId: null }, importedState: snapshot.state };
    const data = { baseSalary: totals.baseSalary, grossPay: totals.grossPay, allowanceTotal: totals.allowanceTotal, deductionTotal: totals.deductionTotal, netPay: totals.netPay, currency: snapshot.currency, odooPayslipId: snapshot.odooPayslipId, odooRawData: snapshot.raw as Prisma.InputJsonObject, calculationSnapshot: calculated as unknown as Prisma.InputJsonObject };
    const existing = await tx.payrollItem.findUnique({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: snapshot.employeeId } } });
    if (existing && existing.odooPayslipId !== snapshot.odooPayslipId) throw new Error("يوجد كشف آخر للموظف في هذا المسير؛ لن يُستبدل أو يُجمع تلقائياً");
    const item = await tx.payrollItem.upsert({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: snapshot.employeeId } }, create: { ...data, payrollRunId: run.id, employeeId: snapshot.employeeId }, update: data });
    await tx.auditLog.create({ data: { actorUserId, action: "payroll:odoo-materialize", entity: "payrollRun", entityId: run.id, metadata: { snapshotId, itemId: item.id } } });
    return item;
  });
}
