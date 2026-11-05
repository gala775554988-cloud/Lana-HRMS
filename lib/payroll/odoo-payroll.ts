import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { OdooClient } from "@/lib/integrations/odoo/client";
import type { OdooRecord } from "@/lib/integrations/odoo/types";
import type { Prisma } from "@prisma/client";

export function odooPayrollSource(url: string, database: string) {
  return createHash("sha256").update(new URL(url).origin + "/" + database).digest("hex");
}
export async function fetchDetailedPayslips(client: Pick<OdooClient, "fieldsGet" | "search_read">, onSlip: (slip: OdooRecord, lines: OdooRecord[]) => Promise<void>) {
  const fields = await client.fieldsGet("hr.payslip");
  for (const field of ["id", "employee_id", "date_from", "date_to", "state", "write_date", "line_ids"]) if (!fields[field]) throw new Error(`Odoo payroll field missing: ${field}`);
  const selected = ["id", "name", "number", "employee_id", "date_from", "date_to", "state", "write_date", "line_ids", "move_id", "currency_id", "company_id"].filter(field => fields[field]);
  const lineFields = await client.fieldsGet("hr.payslip.line");
  for (const field of ["id", "name", "code", "amount", "quantity", "rate", "total", "slip_id"]) if (!lineFields[field]) throw new Error(`Odoo payroll line field missing: ${field}`);
  const selectedLines = ["id", "name", "code", "amount", "quantity", "rate", "total", "slip_id", "salary_rule_id", "category_id", "sequence"].filter(field => lineFields[field]);
  const results = { imported: 0, skipped: 0, errors: [] as { id: number; message: string }[] };
  let lastId = 0;
  for (;;) {
    const slips = await client.search_read("hr.payslip", [["id", ">", lastId]], selected, { limit: 500, order: "id asc", context: { active_test: false } });
    if (!slips.length) break;
    for (const slip of slips) {
      try {
        const lines: OdooRecord[] = []; let lineId = 0;
        for (;;) {
          const batch = await client.search_read("hr.payslip.line", [["slip_id", "=", slip.id], ["id", ">", lineId]], selectedLines, { limit: 500, order: "id asc", context: { active_test: false } });
          lines.push(...batch);
          if (batch.length < 500) break;
          const next = Number(batch.at(-1)?.id); if (next <= lineId) throw new Error("Invalid line cursor"); lineId = next;
        }
        const expected = Array.isArray(slip.line_ids) ? slip.line_ids.map(Number).sort((a, b) => a - b) : null;
        const received = lines.map(row => Number(row.id)).sort((a, b) => a - b);
        if (!expected || JSON.stringify(expected) !== JSON.stringify(received)) throw new Error("تغيرت بنود الكشف أثناء القراءة أو لم تكتمل؛ أعد المزامنة");
        const latest = await client.search_read("hr.payslip", [["id", "=", slip.id]], ["write_date", "line_ids"], { limit: 1 });
        if (latest[0]?.write_date !== slip.write_date || JSON.stringify(latest[0]?.line_ids) !== JSON.stringify(slip.line_ids)) throw new Error("Payslip changed while reading");
        await onSlip(slip, lines); results.imported++;
      } catch { results.skipped++; results.errors.push({ id: Number(slip.id), message: "تعذر استيراد الكشف كاملاً؛ تحقق من المطابقة والصلاحيات والعملة" }); }
    }
    const next = Number(slips.at(-1)?.id); if (next <= lastId) throw new Error("Invalid payslip cursor"); lastId = next;
    if (slips.length < 500) break;
  }
  return results;
}
function manyId(value: unknown) { return Array.isArray(value) ? Number(value[0]) : typeof value === "number" ? value : null; }
export async function pullOdooPayroll(client: OdooClient, source: string) {
  // Preserve draft, cancelled and completed slips; never flatten their lines into recurring allowances.
  return fetchDetailedPayslips(client, async (slip, lines) => {
    const employee = await prisma.employee.findUnique({ where: { odooId: manyId(slip.employee_id) ?? -1 }, select: { id: true } });
    if (!employee) throw new Error("Employee mapping missing");
    let currencyId = manyId(slip.currency_id);
    if (!currencyId && manyId(slip.company_id)) {
      const companies = await client.search_read("res.company", [["id", "=", manyId(slip.company_id)]], ["currency_id"], { limit: 1 });
      currencyId = manyId(companies[0]?.currency_id);
    }
    if (!currencyId) throw new Error("Payslip currency is required");
    const currencies = await client.search_read("res.currency", [["id", "=", currencyId]], ["name"], { limit: 1 });
    const currency = String(currencies[0]?.name ?? "");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid currency");
    const period = String(slip.date_from).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Invalid period");
    await prisma.odooPayrollSnapshot.upsert({ where: { source_odooPayslipId: { source, odooPayslipId: Number(slip.id) } },
      create: { source, odooPayslipId: Number(slip.id), employeeId: employee.id, state: String(slip.state), period, currency, moveId: manyId(slip.move_id), raw: slip as Prisma.InputJsonObject, lines: lines as Prisma.InputJsonArray },
      update: { employeeId: employee.id, period, state: String(slip.state), currency, moveId: manyId(slip.move_id), raw: slip as Prisma.InputJsonObject, lines: lines as Prisma.InputJsonArray },
    });
  });
}

// Explicitly invoked reconciliation only: this never creates/posts journal entries or confirms remote payslips.
export async function reconcileAccountingOutbox(client: OdooClient, outboxId: string, source: string) {
  const entry = await prisma.payrollAccountingOutbox.findUniqueOrThrow({ where: { id: outboxId } });
  if (entry.status === "SENT") return { alreadyReconciled: true };
  const claimed = await prisma.payrollAccountingOutbox.updateMany({ where: { id: entry.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  if (claimed.count !== 1) throw new Error("المطابقة قيد التنفيذ");
  try {
    const items = await prisma.payrollItem.findMany({ where: { payrollRunId: entry.payrollRunId }, include: { payrollRun: { select: { status: true } } } });
    if (!items.length || items.some(item => !["APPROVED", "PAID", "LOCKED", "ARCHIVED"].includes(item.payrollRun.status))) throw new Error("المسير غير معتمد");
    const matches = [];
    for (const item of items) {
      if (!item.odooPayslipId) throw new Error("لا يوجد كشف Odoo مقابل");
      const local = await prisma.odooPayrollSnapshot.findUniqueOrThrow({ where: { source_odooPayslipId: { source, odooPayslipId: item.odooPayslipId } } });
      const slips = await client.search_read("hr.payslip", [["id", "=", item.odooPayslipId]], ["state", "move_id", "employee_id"], { limit: 1 });
      const slip = slips[0]; const moveId = manyId(slip?.move_id);
      if (!slip || !["done", "paid"].includes(String(slip.state)) || !moveId) throw new Error("كشف Odoo غير معتمد أو القيد المحاسبي غير موجود");
      const moves = await client.search_read("account.move", [["id", "=", moveId]], ["id", "name", "state", "company_id"], { limit: 1 });
      if (moves[0]?.state !== "posted") throw new Error("القيد المحاسبي غير مرحّل");
      const lines = await client.search_read("hr.payslip.line", [["slip_id", "=", item.odooPayslipId], ["code", "=", "NET"]], ["total"], { limit: 2 });
      if (lines.length !== 1 || Math.abs(Number(lines[0].total) - Number(item.netPay)) > 0.005) throw new Error("صافي كشف Odoo لا يطابق المسير المعتمد");
      if (local.employeeId !== item.employeeId) throw new Error("مطابقة الموظف غير صحيحة");
      matches.push({ itemId: item.id, payslipId: item.odooPayslipId, moveId, moveName: String(moves[0].name) });
    }
    await prisma.payrollAccountingOutbox.update({ where: { id: entry.id }, data: { status: "SENT", lastError: null, payload: { matches, reconciledAt: new Date().toISOString() } } });
    return { reconciled: matches.length };
  } catch {
    await prisma.payrollAccountingOutbox.update({ where: { id: entry.id }, data: { status: "FAILED", lastError: "لم تتم المطابقة؛ راجع ربط الموظف والعملة والصافي وحالة القيد في Odoo" } });
    throw new Error("لم تتم مطابقة القيد مع Odoo؛ لم يُنشأ أو يُرحّل أي قيد تلقائياً");
  }
}
