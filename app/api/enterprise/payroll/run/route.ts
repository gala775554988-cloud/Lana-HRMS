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

  for (const field of ["name", "period", "startDate", "endDate", "periodId", "companyId", "branchId", "departmentId", "costCenterId"] as const) {
    const value = body[field];
    if (value !== undefined && (typeof value !== "string" || !value.trim())) {
      return NextResponse.json({ success: false, message: "قيمة غير صالحة: " + field }, { status: 400 });
    }
  }
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }

  // Existing draft periods must never be silently recalculated for a different
  // date range, organization or employee subset. Such a change requires an
  // explicit review workflow; keep the original financial scope immutable here.
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.period)) {
    return NextResponse.json({ success: false, message: "صيغة الفترة يجب أن تكون YYYY-MM" }, { status: 400 });
  }
  if (body.employeeIds !== undefined && (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0 || !body.employeeIds.every(id => typeof id === "string" && id.trim().length > 0) || new Set(body.employeeIds).size !== body.employeeIds.length)) {
    return NextResponse.json({ success: false, message: "قائمة الموظفين غير صالحة أو تحتوي تكرارات" }, { status: 400 });
  }
  if (body.periodId) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: body.periodId }, select: { status: true, startDate: true, endDate: true } });
    if (!period || period.status !== "OPEN") {
      return NextResponse.json({ success: false, message: "فترة الرواتب غير موجودة أو مغلقة" }, { status: 409 });
    }
    if (period.startDate.getTime() !== startDate.getTime() || period.endDate.getTime() !== endDate.getTime()) {
      return NextResponse.json({ success: false, message: "تواريخ المسير لا تطابق فترة الرواتب المحددة" }, { status: 409 });
    }
  }

  let run = await prisma.payrollRun.findUnique({ where: { period: body.period } });
  if (run && run.status !== "DRAFT") {
    return NextResponse.json({ success: false, message: "هذه الفترة لها مسير رواتب سابق ليس في حالة مسودة -- لا يمكن إعادة الحساب" }, { status: 409 });
  }

  if (run && run.status === "DRAFT") {
    const fields = ["periodId", "companyId", "branchId", "departmentId", "costCenterId"] as const;
    const changed = run.periodStartDate?.getTime() !== startDate.getTime() || run.periodEndDate?.getTime() !== endDate.getTime() ||
      fields.some(field => (run[field] ?? null) !== (body[field] ?? null));
    if (changed || body.employeeIds !== undefined) {
      return NextResponse.json({ success: false, message: "لا يمكن تغيير نطاق مسير موجود أثناء إعادة الاحتساب؛ راجع الفترة والجهة وقائمة الموظفين" }, { status: 409 });
    }
  }

  let existingIds = run ? (await prisma.payrollItem.findMany({ where: { payrollRunId: run.id }, select: { employeeId: true } })).map(item => item.employeeId) : undefined;
  if (run && !existingIds?.length) {
    const saved = await prisma.appSetting.findUnique({ where: { key: `payroll.scope.${run.id}` } });
    const scope = saved?.value as { employeeIds?: string[] } | null;
    if (!scope || !Array.isArray(scope.employeeIds) || !scope.employeeIds.length || !scope.employeeIds.every(id => typeof id === "string" && id.trim()) || new Set(scope.employeeIds).size !== scope.employeeIds.length) return NextResponse.json({ success: false, message: "لا يمكن إعادة احتساب مسير بلا قائمة موظفين محفوظة" }, { status: 409 });
    existingIds = scope.employeeIds;
  }

  if (!run) {
    try {
    run = await prisma.$transaction(async (tx) => {
      if (body.periodId) {
        const linked = await tx.payrollPeriod.findUnique({ where: { id: body.periodId } });
        if (!linked || linked.status !== "OPEN" || linked.startDate.getTime() !== startDate.getTime() || linked.endDate.getTime() !== endDate.getTime()) return null;
      }
      const selected = await tx.employee.findMany({ where: {
        status: "ACTIVE", archivedAt: null, hireDate: { lte: endDate },
        OR: [{ terminationDate: null }, { terminationDate: { gte: startDate } }],
        ...(body.companyId ? { companyId: body.companyId } : {}),
        ...(body.branchId ? { branchId: body.branchId } : {}),
        ...(body.departmentId ? { departmentId: body.departmentId } : {}),
        ...(body.employeeIds ? { id: { in: body.employeeIds } } : {})
      }, select: { id: true } });
      if (!selected.length || (body.employeeIds && selected.length !== body.employeeIds.length)) throw new Error("PAYROLL_SCOPE_INVALID");
      existingIds = selected.map(employee => employee.id);
      const created = await tx.payrollRun.create({
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
        createdById: session.user.id!,
        status: "DRAFT"
      }
      });
      await tx.appSetting.create({ data: { key: `payroll.scope.${created.id}`, value: { employeeIds: existingIds } } });
      return created;
    }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof Error && error.message === "PAYROLL_SCOPE_INVALID") return NextResponse.json({ success: false, message: "لا يوجد موظفون مؤهلون أو أن القائمة تتضمن موظفين خارج النطاق" }, { status: 422 });
      if (typeof error === "object" && error !== null && "code" in error && ["P2034", "P2002"].includes(String(error.code))) return NextResponse.json({ success: false, message: "تغيرت الفترة أو تم إنشاء مسير بالتزامن؛ أعد المحاولة" }, { status: 409 });
      throw error;
    }
    if (!run) return NextResponse.json({ success: false, message: "الفترة مغلقة أو تغيرت تواريخها" }, { status: 409 });
  }

  const { employeeCount, items, errorCount } = await computeAndUpsertPayrollItems(run.id, startDate, endDate, {
    employeeIds: existingIds ?? body.employeeIds,
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

  return NextResponse.json({ success: errorCount === 0 && employeeCount > 0, run, computed: errorCount ? 0 : items.length, errors: errorCount, items, ...(errorCount || !employeeCount ? { message: "لم يكتمل احتساب المسير؛ راجع الموظفين والأخطاء قبل الاعتماد" } : {}) }, { status: errorCount || !employeeCount ? 422 : 200 });
}
