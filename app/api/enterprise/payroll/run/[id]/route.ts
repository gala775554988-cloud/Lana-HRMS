import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { computeAndUpsertPayrollItems } from "@/lib/enterprise/payroll-engine";
import { notifyRole } from "@/lib/enterprise/notifications";
import { canManagePayroll, canApprovePayroll, canViewPayroll } from "@/lib/enterprise/payroll-permissions";
import { getPayrollOdooClient } from "@/lib/payroll/connection";
import { odooPayrollSource, reconcileAccountingOutbox } from "@/lib/payroll/odoo-payroll";
import { accountingMappingSchema, postConfiguredPayrollJournal } from "@/lib/payroll/journal";
import { consumeApprovedPayroll } from "@/lib/payroll/settlement";
import type { PayrollBreakdown } from "@/lib/enterprise/payroll-engine";
import type { PayrollStatus } from "@prisma/client";

const TRANSITION_NOTIFICATIONS: Record<string, { roles: string[]; title: string; body: (run: { name: string }) => string; type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" }> = {
  submit: { roles: ["HR_MANAGER", "SUPER_ADMIN"], title: "مسير رواتب بانتظار الاعتماد", body: (run) => `مسير "${run.name}" أُرسل للمراجعة ويحتاج اعتمادك.`, type: "INFO" },
  approve: { roles: ["PAYROLL_OFFICER", "SUPER_ADMIN"], title: "تم اعتماد مسير الرواتب", body: (run) => `تم اعتماد مسير "${run.name}"، جاهز للصرف.`, type: "SUCCESS" },
  pay: { roles: ["HR_MANAGER", "PAYROLL_OFFICER", "SUPER_ADMIN"], title: "تم صرف الرواتب", body: (run) => `تم صرف رواتب مسير "${run.name}" بنجاح.`, type: "SUCCESS" },
  cancel: { roles: ["HR_MANAGER", "PAYROLL_OFFICER", "SUPER_ADMIN"], title: "تم إلغاء مسير رواتب", body: (run) => `تم إلغاء مسير "${run.name}".`, type: "WARNING" },
  lock: { roles: ["HR_MANAGER", "SUPER_ADMIN"], title: "تم قفل مسير الرواتب", body: (run) => `تم قفل مسير "${run.name}" نهائياً بعد الصرف.`, type: "INFO" },
  unlock: { roles: ["HR_MANAGER", "SUPER_ADMIN"], title: "تم فتح قفل مسير الرواتب", body: (run) => `تم إعادة فتح مسير "${run.name}" للتعديل.`, type: "WARNING" },
  archive: { roles: ["HR_MANAGER", "SUPER_ADMIN"], title: "تمت أرشفة مسير الرواتب", body: (run) => `تمت أرشفة مسير "${run.name}".`, type: "INFO" }
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewPayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

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

  const historyRaw = await prisma.auditLog.findMany({
    where: { entity: "payrollRun", entityId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { name: true } } }
  });
  const history = historyRaw.map((entry) => ({
    id: entry.id,
    action: entry.action,
    actorName: entry.actor?.name ?? "النظام",
    createdAt: entry.createdAt,
    metadata: entry.metadata
  }));

  return NextResponse.json({ success: true, run, totals, employeeCount: run.items.length, history });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const canManage = canManagePayroll(session);
  const canApprove = canApprovePayroll(session);
  if (!canManage && !canApprove) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as { action?: string; reason?: string } | null;
  const action = body?.action;
  if (typeof action !== "string" || !action) return NextResponse.json({ success: false, message: "action is required" }, { status: 400 });

  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  // Recalculate isn't a status transition -- it just re-runs the compute
  // engine for the run's already-matched employees. Only allowed before
  // approval (DRAFT/PROCESSING): once APPROVED/PAID, numbers are final and
  // must go through the controlled pay-time recompute+consume instead, never
  // a silent recalculation that could change what was approved.
  if (action === "recalculate") {
    if (!["DRAFT", "PROCESSING"].includes(run.status)) {
      return NextResponse.json({ success: false, message: `لا يمكن إعادة الاحتساب لمسير في حالة ${run.status}` }, { status: 409 });
    }
    if (!canManagePayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (!run.periodStartDate || !run.periodEndDate) {
      return NextResponse.json({ success: false, message: "لا يمكن إعادة الاحتساب -- الفترة الزمنية للمسير غير محددة" }, { status: 409 });
    }
    const { employeeCount, items, errorCount } = await computeAndUpsertPayrollItems(id, run.periodStartDate, run.periodEndDate, {
      companyId: run.companyId ?? undefined,
      branchId: run.branchId ?? undefined,
      departmentId: run.departmentId ?? undefined,
      costCenterId: run.costCenterId ?? undefined
    });
    await writeAuditLog({
      actorUserId: session.user.id,
      action: "payroll_recalculate",
      entity: "payrollRun",
      entityId: id,
      metadata: { employeeCount, errors: errorCount }
    });
    return NextResponse.json({ success: true, computed: items.length, errors: errorCount });
  }

  const transitions: Record<string, { from: PayrollStatus[]; to: PayrollStatus; requiresApprover?: boolean }> = {
    submit: { from: ["DRAFT"], to: "PROCESSING" },
    approve: { from: ["PROCESSING"], to: "APPROVED", requiresApprover: true },
    pay: { from: ["APPROVED"], to: "PAID", requiresApprover: true },
    cancel: { from: ["DRAFT", "PROCESSING", "APPROVED"], to: "CANCELLED" },
    lock: { from: ["PAID"], to: "LOCKED", requiresApprover: true },
    unlock: { from: ["LOCKED"], to: "PAID", requiresApprover: true },
    archive: { from: ["LOCKED", "CANCELLED"], to: "ARCHIVED", requiresApprover: true }
  };

  const transition = transitions[action];
  if (!Object.hasOwn(transitions, action) || !transition) return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  if (!transition.from.includes(run.status)) {
    return NextResponse.json({ success: false, message: `لا يمكن تنفيذ "${action}" على مسير في حالة ${run.status}` }, { status: 409 });
  }

  const needsApproval = transition.requiresApprover || (action === "cancel" && run.status === "APPROVED");
  const allowed = needsApproval ? canApprove : canManage;
  if (!allowed) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const now = new Date();
  const data: Record<string, unknown> = { status: transition.to };
  if (action === "submit") data.submittedAt = now;
  if (action === "approve") { data.approvedAt = now; data.approvedById = session.user.id; }
  if (action === "pay") data.paidAt = now;
  if (action === "lock") { data.lockedAt = now; data.lockedById = session.user.id; }
  if (action === "unlock") { data.lockedAt = null; data.lockedById = null; }
  if (action === "archive") { data.archivedAt = now; data.archivedById = session.user.id; }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollRun.updateMany({ where: { id, status: run.status, updatedAt: run.updatedAt }, data });
      if (claimed.count !== 1) throw new Error("تغير المسير أثناء الإجراء؛ حدّث الصفحة");
      if (action === "approve" || action === "pay") {
        const computation = await tx.appSetting.findUnique({ where: { key: `payroll.compute.${id}` } });
        if (Number((computation?.value as { errorCount?: number } | null)?.errorCount ?? 0) > 0) throw new Error("توجد أخطاء احتساب غير معالجة؛ أعد احتساب المسير قبل الاعتماد");
        const items = await tx.payrollItem.findMany({ where: { payrollRunId: id } });
        if (!items.length) throw new Error("لا يمكن اعتماد أو صرف مسير فارغ");
        for (const item of items) {
          const snapshot = item.calculationSnapshot as unknown as PayrollBreakdown;
          if (!snapshot || !Number.isFinite(snapshot.netPay) || Math.abs(Number(item.netPay) - snapshot.netPay) > 0.005 || !Array.isArray(snapshot.loanAllocations)) throw new Error("أعد احتساب المسير؛ لقطة الحساب غير مكتملة");
          for (const field of ["baseSalary", "allowanceTotal", "grossPay", "deductionTotal", "netPay"] as const) if (!Number.isFinite(snapshot[field]) || Math.abs(Number(item[field]) - snapshot[field]) > 0.005) throw new Error("تغيرت الأرقام عن لقطة الحساب؛ يلزم إعادة المراجعة");
          if (Number(item.netPay) < 0) throw new Error("لا يمكن صرف صافي راتب سالب");
          if (action === "pay") await consumeApprovedPayroll(tx, snapshot, item.employeeId, now);
        }
        const mapping = await tx.appSetting.findUnique({ where: { key: "payroll.odooAccounting" } });
        if (action === "approve" && (items.some(item => item.odooPayslipId !== null) || (mapping?.value as { mode?: string } | null)?.mode === "POST_JOURNAL")) {
          await tx.payrollAccountingOutbox.upsert({ where: { payrollRunId: id }, create: { payrollRunId: id, payload: { runId: id, payslipIds: items.map(item => item.odooPayslipId).filter(Boolean), action: items.some(item => item.odooPayslipId !== null) ? "RECONCILE_APPROVED" : "POST_LOCAL" } }, update: {} });
        }
      }
      if (action === "pay") await tx.payrollItem.updateMany({ where: { payrollRunId: id }, data: { payslipIssuedAt: now } });
      await tx.auditLog.create({ data: { actorUserId: session.user.id, action: `payroll_${action}`, entity: "payrollRun", entityId: id, metadata: { from: run.status, to: transition.to, reason: body?.reason ?? null } } });
      return tx.payrollRun.findUniqueOrThrow({ where: { id } });
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "تعذر تنفيذ العملية" }, { status: 409 });
  }


  if (action === "approve") {
    const pending = await prisma.payrollAccountingOutbox.findUnique({ where: { payrollRunId: id } });
    if (pending && pending.status !== "SENT") {
      try {
        const mapping = accountingMappingSchema.safeParse((await prisma.appSetting.findUnique({ where: { key: "payroll.odooAccounting" } }))?.value);
        const { client } = await getPayrollOdooClient(mapping.success ? mapping.data.connectionId : undefined);
        const config = client.getConfig();
        if (mapping.success && mapping.data.mode === "POST_JOURNAL" && (pending.payload as { action?: string }).action === "POST_LOCAL") await postConfiguredPayrollJournal(client, pending.id, mapping.data);
        else await reconcileAccountingOutbox(client, pending.id, odooPayrollSource(config.url, config.database));
      } catch {
        await prisma.payrollAccountingOutbox.updateMany({ where: { id: pending.id, status: "PENDING" }, data: { status: "FAILED", lastError: "تحتاج المطابقة إعداد اتصال Odoo أو مراجعة القيود؛ أعد المحاولة من لوحة التعويضات" } });
      }
    }
  }

  const notification = TRANSITION_NOTIFICATIONS[action];
  if (notification) {
    await notifyRole(
      notification.roles,
      notification.title,
      notification.body(updated),
      notification.type,
      `/payroll?tab=payroll-run&runId=${id}`
    ).catch(() => undefined);
  }

  return NextResponse.json({ success: true, run: updated });
}
