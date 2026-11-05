import { money } from "./calculations";
import type { OdooClient } from "@/lib/integrations/odoo/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
export const accountingMappingSchema = z.object({ mode: z.enum(["RECONCILE", "POST_JOURNAL"]), connectionId: z.string().min(1).optional(), companyId: z.number().int().positive(), journalId: z.number().int().positive(), currencyId: z.number().int().positive(), expenseAccountId: z.number().int().positive(), deductionAccountId: z.number().int().positive(), salaryPayableAccountId: z.number().int().positive(), employerExpenseAccountId: z.number().int().positive(), employerPayableAccountId: z.number().int().positive() }).strict();
type Mapping = z.infer<typeof accountingMappingSchema>;
type Component = { code: string; name: string; kind: string; amount: number };
export function buildPayrollJournal(items: { reference: string; netPay: number; employerInsurance: number; components: Component[] }[], mapping: Mapping) {
  const lines: { name: string; account_id: number; debit: number; credit: number }[] = [];
  const add = (name: string, account: number, signedDebit: number) => {
    const amount = money(signedDebit); if (!amount) return;
    lines.push({ name, account_id: account, debit: amount > 0 ? amount : 0, credit: amount < 0 ? -amount : 0 });
  };
  for (const item of items) {
    if (!Number.isFinite(item.netPay) || item.netPay < 0 || !item.components.length) throw new Error("Incomplete journal payroll source");
    for (const component of item.components) {
      if (["EARNING", "BASIC", "ALLOWANCE"].includes(component.kind)) add(`${item.reference} ${component.code} ${component.name}`, mapping.expenseAccountId, component.amount);
      else if (component.kind === "DEDUCTION") add(`${item.reference} ${component.code} ${component.name}`, mapping.deductionAccountId, -Math.abs(component.amount));
      else if (!["GROSS", "NET", "INFORMATION", "EMPLOYER"].includes(component.kind)) throw new Error("Unmapped payroll journal component");
    }
    add(`${item.reference} NET`, mapping.salaryPayableAccountId, -item.netPay);
    add(`${item.reference} GOSI employer expense`, mapping.employerExpenseAccountId, item.employerInsurance);
    add(`${item.reference} GOSI employer payable`, mapping.employerPayableAccountId, -item.employerInsurance);
  }
  const debit = money(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = money(lines.reduce((sum, line) => sum + line.credit, 0));
  if (!lines.length || Math.abs(debit - credit) > 0.005) throw new Error("القيد غير متوازن؛ راجع تفاصيل الاستحقاقات والاستقطاعات");
  return { lines, debit, credit };
}
export async function postConfiguredPayrollJournal(client: OdooClient, outboxId: string, mapping: Mapping) {
  const writer = client.forFinancialWrites();
  const entry = await prisma.payrollAccountingOutbox.findUniqueOrThrow({ where: { id: outboxId } });
  if (entry.status === "SENT") return;
  const claimed = await prisma.payrollAccountingOutbox.updateMany({ where: { id: outboxId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  if (claimed.count !== 1) throw new Error("القيد قيد الإرسال");
  try {
    const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: entry.payrollRunId }, include: { items: true } });
    if (!["APPROVED", "PAID", "LOCKED"].includes(run.status) || !run.periodEndDate) throw new Error("المسير غير معتمد أو تاريخه غير محدد");
    if (run.items.some(item => item.odooPayslipId !== null)) throw new Error("المسيرات المستوردة تطابق القيود الأصلية؛ لن تُنشئ قيداً مكرراً");
    const currencies = await client.search_read("res.currency", [["id", "=", mapping.currencyId]], ["name"], { limit: 1 });
    if (run.items.some(item => item.currency !== currencies[0]?.name)) throw new Error("عملة القيد لا تطابق العملات في المسير");
    const journal = await client.search_read("account.journal", [["id", "=", mapping.journalId], ["company_id", "=", mapping.companyId]], ["id"], { limit: 1 });
    if (!journal.length) throw new Error("دفتر اليومية خارج الشركة المحددة");
    const built = buildPayrollJournal(run.items.map(item => ({ reference: item.employeeId, netPay: Number(item.netPay), employerInsurance: Number(item.employerInsurance), components: (item.calculationSnapshot as { components?: Component[] } | null)?.components ?? [] })), mapping);
    const reference = `LANA-PAYROLL-${run.id}`;
    const existing = await client.search_read("account.move", [["ref", "=", reference], ["company_id", "=", mapping.companyId]], ["id", "state", "journal_id", "date"], { limit: 2 });
    if (existing.length > 1) throw new Error("توجد قيود متعددة للمرجع؛ يلزم تدخل المحاسب");
    let moveId = existing.length ? Number(existing[0].id) : null;
    if (moveId) {
      const remoteJournal = Array.isArray(existing[0].journal_id) ? Number(existing[0].journal_id[0]) : Number(existing[0].journal_id);
      if (remoteJournal !== mapping.journalId || existing[0].date !== run.periodEndDate.toISOString().slice(0,10)) throw new Error("المرجع الموجود يخص دفتراً أو تاريخاً مختلفاً");
      const remoteLines = []; let last = 0;
      for (;;) {
        const batch = await client.search_read("account.move.line", [["move_id", "=", moveId], ["id", ">", last]], ["id", "name", "account_id", "debit", "credit"], { limit: 500, order: "id asc" });
        remoteLines.push(...batch); if (batch.length < 500) break; last = Number(batch.at(-1)?.id);
      }
      const canonical = (lines: typeof built.lines) => lines.map(row => JSON.stringify([row.name, row.account_id, money(row.debit), money(row.credit)])).sort();
      const remoteCanonical = canonical(remoteLines.map(row => ({ name: String(row.name), account_id: Number(Array.isArray(row.account_id) ? row.account_id[0] : row.account_id), debit: Number(row.debit), credit: Number(row.credit) })));
      if (JSON.stringify(remoteCanonical) !== JSON.stringify(canonical(built.lines))) throw new Error("القيد الموجود لا يطابق لقطة المسير؛ لن يُستبدل");
    } else {
      moveId = await writer.create("account.move", { ref: reference, move_type: "entry", date: run.periodEndDate.toISOString().slice(0,10), journal_id: mapping.journalId, company_id: mapping.companyId, line_ids: built.lines.map(line => [0, 0, line]) });
    }
    // A failed/lost response is retried by searching the stable reference, never blindly creating again.
    if (existing[0]?.state !== "posted") await writer.execute_kw("account.move", "action_post", [[moveId]]);
    const verified = await client.search_read("account.move", [["id", "=", moveId]], ["state"], { limit: 1 });
    if (verified[0]?.state !== "posted") throw new Error("القيد لم يُرحل");
    await prisma.payrollAccountingOutbox.update({ where: { id: entry.id }, data: { status: "SENT", lastError: null, payload: { moveId, reference, debit: built.debit, credit: built.credit } } });
  } catch {
    await prisma.payrollAccountingOutbox.update({ where: { id: entry.id }, data: { status: "FAILED", lastError: "تعذر ترحيل القيد؛ تحقق من الشركة والدفتر والحسابات والتوازن وحالة المرجع في Odoo قبل إعادة المحاولة" } });
    throw new Error("لم يكتمل ترحيل القيد إلى Odoo؛ راجع مهمة المطابقة");
  }
}
