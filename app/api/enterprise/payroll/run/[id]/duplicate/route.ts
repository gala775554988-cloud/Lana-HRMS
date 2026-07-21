import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { computeAndUpsertPayrollItems } from "@/lib/enterprise/payroll-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canManagePayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || roles.includes("PAYROLL_OFFICER") || hasPermission(permissions, { action: "manage", resource: "payroll" });
}

/** Duplicate copies a run's scope (branch/department/cost center) into a new
 * DRAFT run for a different period, then computes it via the same engine as
 * a fresh run -- for the common "same setup, next month" case. Never copies
 * the source run's actual PayrollItem numbers (those must always be freshly
 * computed against the new period's real data), and never touches the
 * source run itself. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManagePayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const source = await prisma.payrollRun.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null) as { name?: string; period?: string; startDate?: string; endDate?: string } | null;
  if (!body?.period || !body.startDate || !body.endDate) {
    return NextResponse.json({ success: false, message: "period, startDate and endDate are required" }, { status: 400 });
  }

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }

  const existing = await prisma.payrollRun.findUnique({ where: { period: body.period } });
  if (existing) {
    return NextResponse.json({ success: false, message: "يوجد مسير رواتب بنفس اسم الفترة بالفعل" }, { status: 409 });
  }

  const duplicated = await prisma.payrollRun.create({
    data: {
      name: body.name || `مسير رواتب ${body.period} (نسخة من ${source.name})`,
      period: body.period,
      periodStartDate: startDate,
      periodEndDate: endDate,
      companyId: source.companyId,
      branchId: source.branchId,
      departmentId: source.departmentId,
      costCenterId: source.costCenterId,
      createdById: session.user.id,
      status: "DRAFT"
    }
  });

  const { employeeCount, items, errorCount } = await computeAndUpsertPayrollItems(duplicated.id, startDate, endDate, {
    companyId: source.companyId ?? undefined,
    branchId: source.branchId ?? undefined,
    departmentId: source.departmentId ?? undefined,
    costCenterId: source.costCenterId ?? undefined
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "payroll_duplicate",
    entity: "payrollRun",
    entityId: duplicated.id,
    metadata: { sourceRunId: id, period: body.period, employeeCount, errors: errorCount }
  });

  return NextResponse.json({ success: true, run: duplicated, computed: items.length, errors: errorCount });
}
