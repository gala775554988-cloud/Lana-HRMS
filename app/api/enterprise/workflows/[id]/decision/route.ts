import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { canManageApprovalRouting } from "@/config/request-routing";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createEnterpriseNotification } from "@/lib/enterprise/notifications";
import { decideWorkflowStep } from "@/lib/enterprise/workflow";
import { mergeWorkflowStepMetadata } from "@/lib/enterprise/workflow-step-metadata";

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

function deferDate(preset?: string, customDate?: string) {
  if (customDate) return new Date(customDate);
  const date = new Date();
  if (preset === "two-days") date.setDate(date.getDate() + 2);
  else if (preset === "week") date.setDate(date.getDate() + 7);
  else date.setDate(date.getDate() + 1);
  return date;
}

function canManageStep(session: any, approverUserId: string | null | undefined) {
  const roles = (session.user.roles as string[]) ?? [];
  return approverUserId === session.user.id || canManageApprovalRouting(roles, session.user.permissions);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({})) as {
      decision?: "APPROVE" | "REJECT" | "RETURN" | "TRANSFER" | "DEFER" | "NOTE" | "PRIORITY";
      comments?: string;
      targetUserId?: string;
      deferPreset?: "tomorrow" | "two-days" | "week" | "custom";
      deferUntil?: string;
      priority?: "Low" | "Normal" | "High";
    };

    if (!body.decision || !["APPROVE", "REJECT", "RETURN", "TRANSFER", "DEFER", "NOTE", "PRIORITY"].includes(body.decision)) {
      return NextResponse.json({ success: false, message: "Invalid decision" }, { status: 400 });
    }

    if (["APPROVE", "REJECT", "RETURN"].includes(body.decision)) {
      const workflow = await decideWorkflowStep({
        workflowInstanceId: id,
        actorUserId: session.user.id,
        decision: body.decision as "APPROVE" | "REJECT" | "RETURN",
        comments: body.comments,
        ip: getClientIp(request)
      });
      return NextResponse.json({ success: true, workflow });
    }

    const instance = await prisma.workflowInstance.findUnique({ where: { id }, include: { steps: { orderBy: { step: "asc" } } } });
    if (!instance) return NextResponse.json({ success: false, message: "Workflow not found" }, { status: 404 });
    if (instance.status !== "PENDING") return NextResponse.json({ success: false, message: "تم البت في الطلب بالفعل." }, { status: 409 });
    const currentStep = instance.steps.find((step) => step.step === instance.currentStep && ["PENDING", "DEFERRED"].includes(step.status));
    if (!currentStep) return NextResponse.json({ success: false, message: "No active workflow step" }, { status: 400 });
    if (!canManageStep(session, currentStep.approverUserId)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    async function updateActiveStep(data: { data: Parameters<typeof prisma.workflowStep.update>[0]["data"] }) {
      const changed = await prisma.workflowStep.updateMany({ where: { id: currentStep!.id, status: { in: ["PENDING", "DEFERRED"] }, approverUserId: currentStep!.approverUserId, workflowInstance: { status: "PENDING", currentStep: instance!.currentStep } }, data: data.data });
      if (changed.count !== 1) throw new Error("تغير الطلب أثناء الإجراء. حدّث الصفحة.");
    }

    if (body.decision === "TRANSFER") {
      if (!body.targetUserId) return NextResponse.json({ success: false, message: "targetUserId is required" }, { status: 400 });
      if (body.targetUserId === session.user.id) return NextResponse.json({ success: false, message: "لا يمكن تحويل الطلب إلى نفسك" }, { status: 400 });
      const requester = await prisma.employee.findUnique({ where: { id: instance.employeeId }, select: { userId: true } });
      if (requester?.userId === body.targetUserId) return NextResponse.json({ success: false, message: "لا يمكن تحويل الطلب لمقدمه ليعتمده بنفسه." }, { status: 400 });
      const target = await prisma.user.findUnique({ where: { id: body.targetUserId }, select: { id: true, isActive: true } });
      if (!target?.isActive) return NextResponse.json({ success: false, message: "المعتمد المحدد غير موجود أو غير نشط" }, { status: 400 });
      await updateActiveStep({
        data: {
          approverUserId: body.targetUserId,
          status: "PENDING",
          comments: mergeWorkflowStepMetadata(currentStep.comments, {
            transferred: true,
            transferredBy: session.user.id,
            note: body.comments?.trim() || undefined
          })
        }
      });
      await createEnterpriseNotification({ userId: body.targetUserId, title: "تحويل طلب", body: `A ${instance.type} request has been transferred to you.`, type: "INFO", link: `/approvals?tab=inbox&highlight=${instance.id}` }).catch(() => null);
    }

    if (body.decision === "DEFER") {
      const until = deferDate(body.deferPreset, body.deferUntil);
      await updateActiveStep({
        data: {
          status: "DEFERRED",
          comments: mergeWorkflowStepMetadata(currentStep.comments, {
            deferredUntil: until.toISOString(),
            note: body.comments?.trim() || undefined
          })
        }
      });
    }

    if (body.decision === "NOTE") {
      await updateActiveStep({
        data: { comments: mergeWorkflowStepMetadata(currentStep.comments, { note: body.comments?.trim() || undefined }) }
      });
    }

    if (body.decision === "PRIORITY") {
      await updateActiveStep({
        data: {
          comments: mergeWorkflowStepMetadata(currentStep.comments, {
            priority: body.priority ?? "Normal",
            note: body.comments?.trim() || undefined
          })
        }
      });
    }

    await writeAuditLog({
      actorUserId: session.user.id,
      action: `workflow:${body.decision.toLowerCase()}`,
      entity: "workflowInstance",
      entityId: id,
      metadata: { ...body, ip: getClientIp(request), employeeId: instance.employeeId, type: instance.type }
    });

    const workflow = await prisma.workflowInstance.findUnique({ where: { id }, include: { steps: { orderBy: { step: "asc" } } } });
    return NextResponse.json({ success: true, workflow });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update request" },
      { status: 400 }
    );
  }
}
