import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createEnterpriseNotification } from "@/lib/enterprise/notifications";
import { decideWorkflowStep } from "@/lib/enterprise/workflow";

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
  return approverUserId === session.user.id || roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
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
    const currentStep = instance.steps.find((step) => step.step === instance.currentStep && ["PENDING", "DEFERRED"].includes(step.status));
    if (!currentStep) return NextResponse.json({ success: false, message: "No active workflow step" }, { status: 400 });
    if (!canManageStep(session, currentStep.approverUserId)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    if (body.decision === "TRANSFER") {
      if (!body.targetUserId) return NextResponse.json({ success: false, message: "targetUserId is required" }, { status: 400 });
      await prisma.workflowStep.update({
        where: { id: currentStep.id },
        data: { approverUserId: body.targetUserId, status: "PENDING", comments: JSON.stringify({ transferred: true, by: session.user.id, note: body.comments ?? "" }) }
      });
      await createEnterpriseNotification({ userId: body.targetUserId, title: "تحويل طلب", body: `A ${instance.type} request has been transferred to you.`, type: "INFO", link: `/approvals?tab=inbox&highlight=${instance.id}` }).catch(() => null);
    }

    if (body.decision === "DEFER") {
      const until = deferDate(body.deferPreset, body.deferUntil);
      await prisma.workflowStep.update({
        where: { id: currentStep.id },
        data: { status: "DEFERRED", comments: JSON.stringify({ deferredUntil: until.toISOString(), note: body.comments ?? "" }) }
      });
    }

    if (body.decision === "NOTE") {
      await prisma.workflowStep.update({
        where: { id: currentStep.id },
        data: { comments: JSON.stringify({ note: body.comments ?? "" }) }
      });
    }

    if (body.decision === "PRIORITY") {
      await prisma.workflowStep.update({
        where: { id: currentStep.id },
        data: { comments: JSON.stringify({ priority: body.priority ?? "Normal", note: body.comments ?? "" }) }
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
