import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { computeEmployeePayroll, markPayrollSourcesConsumed } from "@/lib/enterprise/payroll-engine";
import type { PayrollStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canManagePayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || roles.includes("PAYROLL_OFFICER") || hasPermission(permissions, { action: "manage", resource: "payroll" });
}

/** Only HR_MANAGER/SUPER_ADMIN can approve or disburse a run -- PAYROLL_OFFICER
 * (and anyone with plain manage:payroll) can create/submit/cancel a DRAFT, but
 * the second pair of eyes on money leaving the company is a hard role check,
 * not just a permission flag. This is a deliberately simpler two-tier
 * approval (create/submit -> approve/pay) rather than the generic per-employee
 * WorkflowInstance engine, which is anchored to a single employee's org unit
 * and doesn't fit a run spanning many employees at once. */
function canApprovePayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManagePayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      costCenter: { select: { id: true, name: true, code: true } },
      payrollPeriod: { select: { id: true, name: true, status: true } },
      items: {
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { netPay: "desc" }
      }
    }
  });
  if (!run) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const totals = run.items.reduce(
    (acc, item) => ({
      gross: acc.gross + Number(item.grossPay),
      net: acc.net + Number(item.netPay),
      deductions: acc.deductions + Number(item.deductionTotal)
    }),
    { gross: 0, net: 0, deductions: 0 }
  );

  return NextResponse.json({ success: true, run, totals, employeeCount: run.items.length });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as { action?: string; reason?: string } | null;
  const action = body?.action;
  if (!action) return NextResponse.json({ success: false, message: "action is required" }, { status: 400 });

  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const transitions: Record<string, { from: PayrollStatus[]; to: PayrollStatus; requiresApprover?: boolean }> = {
    submit: { from: ["DRAFT"], to: "PROCESSING" },
    approve: { from: ["PROCESSING"], to: "APPROVED", requiresApprover: true },
    pay: { from: ["APPROVED"], to: "PAID", requiresApprover: true },
    cancel: { from: ["DRAFT", "PROCESSING", "APPROVED"], to: "CANCELLED" }
  };

  const transition = transitions[action];
  if (!transition) return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  if (!transition.from.includes(run.status)) {
    return NextResponse.json({ success: false, message: `لا يمكن تنفيذ "${action}" على مسير في حالة ${run.status}` }, { status: 409 });
  }

  const allowed = transition.requiresApprover ? canApprovePayroll(session) : canManagePayroll(session);
  if (!allowed) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const now = new Date();
  const data: Record<string, unknown> = { status: transition.to };
  if (action === "submit") data.submittedAt = now;
  if (action === "approve") { data.approvedAt = now; data.approvedById = session.user.id; }
  if (action === "pay") data.paidAt = now;

  // Paying is the ONE point where payroll numbers are finalized and the
  // sources they draw from are actually consumed: overtime/bonus rows get
  // marked included (so a later run never double-pays them) and loan/advance
  // balances are decremented by what's genuinely being disbursed now. A
  // DRAFT/PROCESSING/APPROVED run may have been recomputed several times
  // before this moment (see run/route.ts) without ever touching those
  // balances -- this recomputes fresh right before paying so what's marked
  // consumed matches what's actually recorded as paid.
  if (action === "pay" && run.periodStartDate && run.periodEndDate) {
    const items = await prisma.payrollItem.findMany({ where: { payrollRunId: id }, select: { id: true, employeeId: true } });
    for (const item of items) {
      const breakdown = await computeEmployeePayroll(item.employeeId, run.periodStartDate, run.periodEndDate);
      await prisma.payrollItem.update({
        where: { id: item.id },
        data: {
          baseSalary: breakdown.baseSalary,
          allowanceTotal: breakdown.allowanceTotal,
          bonusTotal: breakdown.bonusTotal,
          overtimeTotal: breakdown.overtimeTotal,
          grossPay: breakdown.grossPay,
          insuranceDeduction: breakdown.insuranceDeduction,
          taxTotal: breakdown.taxTotal,
          loanDeduction: breakdown.loanDeduction,
          advanceDeduction: breakdown.advanceDeduction,
          absenceDeduction: breakdown.absenceDeduction,
          lateDeduction: breakdown.lateDeduction,
          penaltyDeduction: breakdown.penaltyDeduction,
          deductionTotal: breakdown.deductionTotal,
          netPay: breakdown.netPay,
          currency: breakdown.currency
        }
      });
      await markPayrollSourcesConsumed(breakdown, item.employeeId);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRun = await tx.payrollRun.update({ where: { id }, data });
    if (action === "pay") {
      await tx.payrollItem.updateMany({ where: { payrollRunId: id }, data: { payslipIssuedAt: now } });
    }
    return updatedRun;
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: `payroll_${action}`,
    entity: "payrollRun",
    entityId: id,
    metadata: { from: run.status, to: transition.to, reason: body?.reason }
  });

  return NextResponse.json({ success: true, run: updated });
}
