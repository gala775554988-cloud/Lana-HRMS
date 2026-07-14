import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const instance = await prisma.workflowInstance.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { step: "asc" } },
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } }
    }
  });
  if (!instance) return NextResponse.json({ success: false, message: "Workflow not found" }, { status: 404 });

  const approverUserIds = instance.steps.map((step) => step.approverUserId).filter((value): value is string => Boolean(value));
  const approvers = approverUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: approverUserIds } }, select: { id: true, name: true, email: true } })
    : [];
  const approverById = new Map(approvers.map((approver) => [approver.id, approver]));

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
      steps: instance.steps.map((step) => ({
        id: step.id,
        step: step.step,
        status: step.status,
        approvedAt: step.approvedAt,
        comments: step.comments,
        createdAt: step.createdAt,
        approver: step.approverUserId ? approverById.get(step.approverUserId) ?? { id: step.approverUserId, name: null, email: null } : null
      }))
    }
  });
}
