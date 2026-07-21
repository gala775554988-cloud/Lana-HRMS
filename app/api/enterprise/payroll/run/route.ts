import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { computeEmployeePayroll } from "@/lib/enterprise/payroll-engine";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canManagePayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || roles.includes("PAYROLL_OFFICER") || hasPermission(permissions, { action: "manage", resource: "payroll" });
}

/** Creates (or reuses, if still DRAFT) a PayrollRun for a period and computes
 * every matched employee's PayrollItem via the payroll engine. Safe to call
 * again on the same DRAFT run before it's submitted or paid -- items are
 * upserted, not duplicated, and this is a pure read+compute: it deliberately
 * does NOT mark overtime/bonus rows consumed or touch loan/advance balances,
 * since a DRAFT is just an estimate that may be recomputed many times before
 * anything is actually paid. That consumption only happens once, atomically,
 * when the run transitions to PAID (see run/[id]/route.ts). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManagePayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    name?: string;
    period?: string;
    periodId?: string;
    startDate?: string;
    endDate?: string;
    companyId?: string;
    branchId?: string;
    departmentId?: string;
    costCenterId?: string;
    employeeIds?: string[];
  } | null;

  if (!body?.period || !body.startDate || !body.endDate) {
    return NextResponse.json({ success: false, message: "period, startDate and endDate are required" }, { status: 400 });
  }

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }

  let run = await prisma.payrollRun.findUnique({ where: { period: body.period } });
  if (run && run.status !== "DRAFT") {
    return NextResponse.json({ success: false, message: "هذه الفترة لها مسير رواتب سابق ليس في حالة مسودة -- لا يمكن إعادة الحساب" }, { status: 409 });
  }

  if (!run) {
    run = await prisma.payrollRun.create({
      data: {
        name: body.name || `مسير رواتب ${body.period}`,
        period: body.period,
        periodId: body.periodId,
        periodStartDate: startDate,
        periodEndDate: endDate,
        companyId: body.companyId,
        branchId: body.branchId,
        departmentId: body.departmentId,
        costCenterId: body.costCenterId,
        createdById: session.user.id,
        status: "DRAFT"
      }
    });
  }

  const employeeWhere: Record<string, unknown> = { status: "ACTIVE" };
  if (body.employeeIds?.length) employeeWhere.id = { in: body.employeeIds };
  if (body.companyId) employeeWhere.companyId = body.companyId;
  if (body.branchId) employeeWhere.branchId = body.branchId;
  if (body.departmentId) employeeWhere.departmentId = body.departmentId;

  const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true } });

  const items: Array<{ employeeId: string; netPay: number; error?: string }> = [];
  for (const employee of employees) {
    try {
      const breakdown = await computeEmployeePayroll(employee.id, startDate, endDate);
      await prisma.payrollItem.upsert({
        where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } },
        update: {
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
          currency: breakdown.currency,
          costCenterId: body.costCenterId
        },
        create: {
          payrollRunId: run.id,
          employeeId: employee.id,
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
          currency: breakdown.currency,
          costCenterId: body.costCenterId
        }
      });
      items.push({ employeeId: employee.id, netPay: breakdown.netPay });
    } catch (error: any) {
      items.push({ employeeId: employee.id, netPay: 0, error: error?.message || String(error) });
    }
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entity: "payrollRun",
    entityId: run.id,
    metadata: { period: body.period, employeeCount: employees.length, errors: items.filter((i) => i.error).length }
  });

  return NextResponse.json({ success: true, run, computed: items.length, errors: items.filter((i) => i.error).length, items });
}
