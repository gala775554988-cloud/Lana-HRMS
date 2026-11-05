import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveApprovalChain } from "@/lib/enterprise/approval-engine";
import { persistEnterpriseWorkflow, notifyWorkflowSubmission } from "@/lib/enterprise/workflow";
import { cancelEntity, entityDelegate, parseRequestEdit, requireAction, requireOwner, RequestLifecycleError } from "@/lib/self-service/lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json();
    const action = String(body.action ?? "");
    const original = await prisma.workflowInstance.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!original) throw new RequestLifecycleError("الطلب غير متاح", 404);
    requireOwner(original.employee.userId, session.user.id);
    if (original.type === "REVOKE") throw new RequestLifecycleError("تتم مراجعة طلب الاسترداد عبر مسؤول الاعتماد");
    requireAction(original.status, action);
    const approvers = ["EDIT", "RESUBMIT", "REVOKE"].includes(action) ? await resolveApprovalChain(original.employeeId, original.type) : [];
    const result = await prisma.$transaction(async tx => {
      // Claim before editing: approval and employee actions cannot both commit.
      const claimed = await tx.workflowInstance.updateMany({ where: { id, status: original.status, updatedAt: original.updatedAt }, data: { updatedAt: new Date() } });
      if (claimed.count !== 1) throw new RequestLifecycleError("تغير الطلب أثناء الإجراء؛ حدّث الصفحة");
      let replacement = null;
      if (action === "REVOKE") {
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason || reason.length > 4000) throw new RequestLifecycleError("سبب طلب الاسترداد مطلوب (حتى 4000 حرف)", 400);
        if (original.type === "LOAN") throw new RequestLifecycleError("القرض المعتمد يتطلب تسوية مالية من الموارد البشرية");
        if (await tx.workflowInstance.findFirst({ where: { type: "REVOKE", entityId: id, status: "PENDING" } })) throw new RequestLifecycleError("يوجد طلب استرداد قيد المراجعة");
        replacement = await persistEnterpriseWorkflow(tx, original.employeeId, "REVOKE", id, approvers);
        await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "workflow:revoke-request", entity: "workflowInstance", entityId: replacement.id, metadata: { reason, originalWorkflowId: id } } });
      } else {
        if (action === "CANCEL") await cancelEntity(tx, original);
        else {
          const changes = parseRequestEdit(original.type, body.data);
          if (original.type === "LEAVE" && "startDate" in changes && "endDate" in changes) {
            const conflict = await tx.leaveRequest.findFirst({ where: { employeeId: original.employeeId, id: { not: original.entityId }, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: changes.endDate }, endDate: { gte: changes.startDate } } });
            if (conflict) throw new RequestLifecycleError("تتعارض الفترة مع طلب إجازة آخر");
          }
          const model = entityDelegate(tx, original.type);
          const entity = await model.findUnique({ where: { id: original.entityId } });
          if (!entity || entity.employeeId !== original.employeeId || entity.status !== "PENDING") throw new RequestLifecycleError("تغيرت حالة الطلب");
          if ((await model.updateMany({ where: { id: original.entityId, status: "PENDING" }, data: changes })).count !== 1) throw new RequestLifecycleError("تغيرت حالة الطلب");
        }
        await tx.workflowInstance.update({ where: { id }, data: { status: action === "CANCEL" ? "CANCELLED" : "SUPERSEDED" } });
        await tx.workflowStep.updateMany({ where: { workflowInstanceId: id, status: { in: ["PENDING", "WAITING", "DEFERRED"] } }, data: { status: "CANCELLED" } });
        if (action !== "CANCEL") replacement = await persistEnterpriseWorkflow(tx, original.employeeId, original.type, original.entityId, approvers);
      }
      await tx.auditLog.create({ data: { actorUserId: session.user.id, action: `workflow:${action.toLowerCase()}`, entity: "workflowInstance", entityId: id, metadata: { replacementId: replacement?.id ?? null } } });
      return replacement;
    });
    if (result) await notifyWorkflowSubmission(result, approvers);
    return NextResponse.json({ success: true, workflow: result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof RequestLifecycleError ? error.message : "تعذر تنفيذ الإجراء؛ حدّث الصفحة وحاول مجدداً" }, { status: error instanceof RequestLifecycleError ? error.status : 400 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await params;
  const workflow = await prisma.workflowInstance.findFirst({ where: { id, employee: { userId: session.user.id } } });
  if (!workflow || workflow.type === "REVOKE") return NextResponse.json({ success: false }, { status: 404 });
  const record = await entityDelegate(prisma, workflow.type).findUnique({ where: { id: workflow.entityId } });
  return NextResponse.json({ success: true, record });
}
