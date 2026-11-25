import type { AppTransaction } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FinancialDirection = "CREDIT" | "DEBIT" | "INFORMATION";
export type RequestSourceType = "LEAVE" | "OVERTIME" | "BONUS" | "ADVANCE" | "PAYROLL";

export type FinancialEffectInput = {
  employeeId: string;
  sourceType: RequestSourceType;
  sourceId: string;
  effectType: string;
  direction: FinancialDirection;
  amount: string;
  currency?: string;
  payrollRunId?: string;
  details?: Record<string, string | number | boolean | null>;
};

/**
 * The financial ledger tracks accrued/settled events. It NEVER transfers money.
 * Each (sourceType, sourceId, effectType) can be processed exactly once.
 * Callers must not confuse request approval with payout or payroll settlement.
 */
async function assertSourceApproved(tx: AppTransaction, input: FinancialEffectInput) {
  if (input.sourceType === "LEAVE") {
    const record = await tx.leaveRequest.findUnique({ where: { id: input.sourceId }, select: { employeeId: true, status: true } });
    if (!record || record.employeeId !== input.employeeId || record.status !== "APPROVED") throw new Error("Leave is not approved for this employee");
    if (input.direction !== "INFORMATION" || input.amount !== "0") throw new Error("Leave approval is not a salary deduction");
  } else if (input.sourceType === "OVERTIME") {
    const record = await tx.overtimeRequest.findUnique({ where: { id: input.sourceId }, select: { employeeId: true, status: true } });
    if (!record || record.employeeId !== input.employeeId || record.status !== "APPROVED") throw new Error("Overtime is not approved");
  } else if (input.sourceType === "BONUS") {
    const record = await tx.employeeBonus.findUnique({ where: { id: input.sourceId }, select: { employeeId: true, status: true } });
    if (!record || record.employeeId !== input.employeeId || record.status !== "APPROVED") throw new Error("Bonus is not approved");
  } else if (input.sourceType === "ADVANCE") {
    const record = await tx.employeeSalaryAdvance.findUnique({ where: { id: input.sourceId }, select: { employeeId: true, status: true } });
    if (!record || record.employeeId !== input.employeeId || record.status !== "APPROVED") throw new Error("Advance is not approved");
    if (input.direction !== "INFORMATION" || input.amount !== "0") throw new Error("Advance approval alone is not evidence of disbursement");
  } else if (input.sourceType === "PAYROLL") {
    const item = await tx.payrollItem.findUnique({ where: { id: input.sourceId }, select: { employeeId: true, payrollRunId: true, payrollRun: { select: { status: true } } } });
    if (!item || item.employeeId !== input.employeeId || !["APPROVED", "PAID"].includes(item.payrollRun.status)) throw new Error("Payroll item is not approved");
    if (input.payrollRunId && item.payrollRunId !== input.payrollRunId) throw new Error("Payroll run mismatch");
  }
}

function validate(input: FinancialEffectInput): Prisma.Decimal {
  if (!input.employeeId || !input.sourceId || !input.effectType || input.effectType.length > 120) throw new Error("Invalid financial source key");
  if (!/^[A-Z]{3}$/.test(input.currency ?? "SAR")) throw new Error("Invalid currency code");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input.amount)) throw new Error("Invalid financial amount format");
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2 || amount.greaterThan("9999999999999999.99")) throw new Error("Invalid financial amount");
  if (input.direction === "INFORMATION" && !amount.isZero()) throw new Error("Information-only event must have zero amount");
  if (input.direction !== "INFORMATION" && amount.isZero()) throw new Error("Monetary event must have positive amount");
  return amount;
}

export async function postApprovedEffectInTransaction(tx: AppTransaction, input: FinancialEffectInput) {
  const amount = validate(input);
  await assertSourceApproved(tx, input);
  await tx.employeeRequestExecution.create({
    data: { employeeId: input.employeeId, sourceType: input.sourceType, sourceId: input.sourceId,
      effectType: input.effectType, state: "EXECUTED", executedAt: new Date(), metadata: input.details ?? undefined }
  });
  return tx.employeeFinancialEntry.create({
    data: { employeeId: input.employeeId, sourceType: input.sourceType, sourceId: input.sourceId,
      effectType: input.effectType, direction: input.direction, amount,
      currency: input.currency ?? "SAR", payrollRunId: input.payrollRunId, details: input.details ?? undefined }
  });
}

export async function postApprovedFinancialEffect(input: FinancialEffectInput) {
  const amount = validate(input);
  try {
    const record = await prisma.$transaction(tx => postApprovedEffectInTransaction(tx, input));
    return { record, duplicate: false };
  } catch (error) {
    // The database unique key wins even when multiple workers process the same approval.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await prisma.employeeFinancialEntry.findUnique({
      where: { sourceType_sourceId_effectType: { sourceType: input.sourceType, sourceId: input.sourceId, effectType: input.effectType } }
    });
    if (!existing || existing.employeeId !== input.employeeId || existing.direction !== input.direction ||
      existing.currency !== (input.currency ?? "SAR") || !existing.amount.equals(amount)) {
      throw new Error("Financial source conflict; manual reconciliation required");
    }
    return { record: existing, duplicate: true };
  }
}

export async function employeeFinancialSummary(employeeId: string) {
  const sums = await prisma.employeeFinancialEntry.groupBy({
    by: ["currency", "direction"], where: { employeeId }, _sum: { amount: true }
  });
  const balances = new Map<string, { currency: string; credits: Prisma.Decimal; debits: Prisma.Decimal }>();
  for (const row of sums) {
    const current = balances.get(row.currency) ?? { currency: row.currency, credits: new Prisma.Decimal(0), debits: new Prisma.Decimal(0) };
    const amount = new Prisma.Decimal(row._sum.amount ?? 0);
    if (row.direction === "CREDIT") current.credits = current.credits.plus(amount);
    if (row.direction === "DEBIT") current.debits = current.debits.plus(amount);
    balances.set(row.currency, current);
  }
  return [...balances.values()].map(row => ({
    currency: row.currency,
    credits: row.credits.toFixed(2),
    debits: row.debits.toFixed(2),
    net: row.credits.minus(row.debits).toFixed(2)
  }));
}
