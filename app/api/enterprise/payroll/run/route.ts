import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAndUpsertPayrollItems } from "@/lib/enterprise/payroll-engine";
import { canManagePayroll } from "@/lib/enterprise/payroll-permissions";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const { employeeCount, items, errorCount } = await computeAndUpsertPayrollItems(run.id, startDate, endDate, {
    employeeIds: body.employeeIds,
    companyId: body.companyId,
    branchId: body.branchId,
    departmentId: body.departmentId,
    costCenterId: body.costCenterId
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entity: "payrollRun",
    entityId: run.id,
    metadata: { period: body.period, employeeCount, errors: errorCount }
  });

  return NextResponse.json({ success: true, run, computed: items.length, errors: errorCount, items });
}
