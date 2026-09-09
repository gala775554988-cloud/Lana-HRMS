import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildEmployeeScopeWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { getRequestEntityDetails } from "@/lib/enterprise/request-details";
import { parseWorkflowStepMetadata } from "@/lib/enterprise/workflow-step-metadata";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roles = (session.user.roles as string[]) ?? [];
  const profile = await getAccessProfile(session.user.id, roles);
  const employeeScope = await buildEmployeeScopeWhere(profile);
  const instance = await prisma.workflowInstance.findFirst({
    where: {
      id,
      OR: [
        { employee: employeeScope },
        { employee: { userId: session.user.id } },
        { steps: { some: { approverUserId: session.user.id } } }
      ]
    },
    include: {
      steps: { orderBy: { step: "asc" } },
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } }
    }
  });
  if (!instance) return NextResponse.json({ success: false, message: "Workflow not found" }, { status: 404 });

  // Mark the pending step as "seen" the moment its assigned approver actually opens this
  // request's detail — not when the requesting employee views their own request.
  const pendingStepForViewer = instance.steps.find(
    (step) => step.step === instance.currentStep && step.status === "PENDING" && step.approverUserId === session.user.id && !step.viewedAt
  );
  if (pendingStepForViewer) {
    const viewedAt = new Date();
    await prisma.workflowStep.update({ where: { id: pendingStepForViewer.id }, data: { viewedAt } });
    pendingStepForViewer.viewedAt = viewedAt;
  }

  const approverUserIds = instance.steps.map((step) => step.approverUserId).filter((value): value is string => Boolean(value));
  const [approvers, details, definition, audit] = await Promise.all([
    approverUserIds.length
      ? prisma.user.findMany({ where: { id: { in: approverUserIds } }, select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
    getRequestEntityDetails(instance.type, instance.entityId),
    prisma.workflowDefinition.findFirst({ where: { entity: instance.type, isActive: true }, orderBy: { updatedAt: "desc" }, select: { name: true, slaHours: true } }).catch(() => null),
    prisma.auditLog.findMany({ where: { entity: "workflowInstance", entityId: instance.id }, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { name: true, email: true } } } })
  ]);
  const approverById = new Map(approvers.map((approver) => [approver.id, approver]));
  const slaHours = definition?.slaHours ?? 48;
  const dueAt = new Date(instance.createdAt.getTime() + slaHours * 60 * 60 * 1000);
  const activeStep = instance.steps.find((step) => step.step === instance.currentStep);
  const activeMetadata = parseWorkflowStepMetadata(activeStep?.comments);

  return NextResponse.json({
    success: true,
    workflow: {
      id: instance.id,
      type: instance.type,
      entityId: instance.entityId,
      status: instance.status,
      currentStep: instance.currentStep,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      employee: instance.employee,
      details,
      serviceLevel: {
        name: definition?.name ?? "المعيار التشغيلي للطلبات",
        hours: slaHours,
        dueAt,
        overdue: instance.status === "PENDING" && dueAt.getTime() < Date.now(),
        deferredUntil: activeMetadata.deferredUntil ?? null
      },
      audit: audit.map((item) => ({
        id: item.id,
        action: item.action,
        createdAt: item.createdAt,
        actor: item.actor?.name ?? item.actor?.email ?? "النظام",
        metadata: item.metadata
      })),
      steps: instance.steps.map((step) => ({
        id: step.id,
        step: step.step,
        status: step.status,
        approvedAt: step.approvedAt,
        comments: step.comments,
        createdAt: step.createdAt,
        viewedAt: step.viewedAt,
        approver: step.approverUserId ? approverById.get(step.approverUserId) ?? { id: step.approverUserId, name: null, email: null } : null
      }))
    }
  });
}
