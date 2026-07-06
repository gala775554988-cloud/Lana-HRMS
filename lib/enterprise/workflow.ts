import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { resolveApprovalChain } from "@/lib/enterprise/hierarchy";

export async function createEnterpriseWorkflow(employeeId: string, type: string, entityId: string) {
  const approverUserIds = await resolveApprovalChain(employeeId);
  const instance = await prisma.workflowInstance.create({
    data: {
      employeeId,
      type,
      entityId,
      status: approverUserIds.length ? "PENDING" : "COMPLETED",
      currentStep: approverUserIds.length ? 1 : 0
    }
  });

  if (approverUserIds.length) {
    await prisma.workflowStep.createMany({
      data: approverUserIds.map((approverUserId, index) => ({
        workflowInstanceId: instance.id,
        step: index + 1,
        approverUserId,
        status: index === 0 ? "PENDING" : "WAITING"
      }))
    });
  }

  return instance;
}

export async function decideWorkflowStep({
  workflowInstanceId,
  actorUserId,
  decision,
  comments,
  ip
}: {
  workflowInstanceId: string;
  actorUserId: string;
  decision: "APPROVE" | "REJECT" | "RETURN";
  comments?: string;
  ip?: string | null;
}) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
    include: { steps: { orderBy: { step: "asc" } } }
  });
  if (!instance) throw new Error("Workflow not found");

  const currentStep = instance.steps.find((step) => step.step === instance.currentStep && step.status === "PENDING");
  if (!currentStep) throw new Error("No pending workflow step");
  if (currentStep.approverUserId && currentStep.approverUserId !== actorUserId) throw new Error("Forbidden");

  const nextStatus = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "RETURNED";
  await prisma.workflowStep.update({
    where: { id: currentStep.id },
    data: { status: nextStatus, approvedAt: new Date(), comments }
  });

  let workflowStatus = instance.status;
  let currentStepNumber = instance.currentStep;
  if (decision === "REJECT") {
    workflowStatus = "REJECTED";
  } else if (decision === "RETURN") {
    workflowStatus = "RETURNED";
  } else {
    const nextStep = instance.steps.find((step) => step.step > instance.currentStep);
    if (nextStep) {
      currentStepNumber = nextStep.step;
      await prisma.workflowStep.update({ where: { id: nextStep.id }, data: { status: "PENDING" } });
    } else {
      workflowStatus = "COMPLETED";
      currentStepNumber = instance.currentStep + 1;
    }
  }

  const updated = await prisma.workflowInstance.update({
    where: { id: workflowInstanceId },
    data: { status: workflowStatus, currentStep: currentStepNumber }
  });

  await writeAuditLog({
    actorUserId,
    action: `workflow:${decision.toLowerCase()}`,
    entity: "workflowInstance",
    entityId: workflowInstanceId,
    metadata: { decision, comments, ip, entityId: instance.entityId, type: instance.type, employeeId: instance.employeeId }
  });

  return updated;
}
