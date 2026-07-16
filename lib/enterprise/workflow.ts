import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { resolveApprovalChain } from "@/lib/enterprise/hierarchy";
import { createEnterpriseNotification, notifyUsers } from "@/lib/enterprise/notifications";

export async function createEnterpriseWorkflow(employeeId: string, type: string, entityId: string) {
  const approvers = await resolveApprovalChain(employeeId, type.toLowerCase());
  const instance = await prisma.workflowInstance.create({
    data: {
      employeeId,
      type,
      entityId,
      status: approvers.length ? "PENDING" : "COMPLETED",
      currentStep: approvers.length ? 1 : 0
    }
  });

  if (approvers.length) {
    await prisma.workflowStep.createMany({
      data: approvers.map((approver, index) => ({
        workflowInstanceId: instance.id,
        step: index + 1,
        approverUserId: approver.userId,
        status: index === 0 ? "PENDING" : "WAITING",
        capabilities: approver.capabilities
      }))
    });
    await notifyUsers([approvers[0].userId], "وصول طلب جديد", `New ${type} request is waiting for your approval.`, "INFO");
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (employee?.userId) {
    await createEnterpriseNotification({
      userId: employee.userId,
      title: approvers.length ? "تم إرسال الطلب" : "تم اعتماد الطلب",
      body: approvers.length ? `Your ${type} request has been submitted.` : `Your ${type} request was approved automatically.`,
      type: approvers.length ? "INFO" : "SUCCESS"
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
  // A step resolved from a VIEW_ONLY approval-chain level (no APPROVE/REJECT
  // capability) may see the request but never decide it.
  const capabilities = currentStep.capabilities?.length ? currentStep.capabilities : ["VIEW", "APPROVE", "REJECT"];
  if (decision === "APPROVE" && !capabilities.includes("APPROVE")) throw new Error("Forbidden");
  if (decision === "REJECT" && !capabilities.includes("REJECT")) throw new Error("Forbidden");
  if (decision === "RETURN" && !capabilities.includes("APPROVE") && !capabilities.includes("REJECT")) throw new Error("Forbidden");

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

  if (instance.type === "OVERTIME") {
    const nextOvertimeStatus = workflowStatus === "COMPLETED" ? "APPROVED" : workflowStatus === "REJECTED" ? "REJECTED" : workflowStatus === "RETURNED" ? "PENDING" : undefined;
    if (nextOvertimeStatus) {
      await prisma.overtimeRequest.update({ where: { id: instance.entityId }, data: { status: nextOvertimeStatus as any } }).catch(() => null);
    }
  }

  await writeAuditLog({
    actorUserId,
    action: `workflow:${decision.toLowerCase()}`,
    entity: "workflowInstance",
    entityId: workflowInstanceId,
    metadata: { decision, comments, ip, entityId: instance.entityId, type: instance.type, employeeId: instance.employeeId }
  });

  const employee = await prisma.employee.findUnique({ where: { id: instance.employeeId }, select: { userId: true } });
  if (employee?.userId) {
    await createEnterpriseNotification({
      userId: employee.userId,
      title: decision === "APPROVE" ? "اعتماد طلب" : decision === "REJECT" ? "رفض طلب" : "إرجاع طلب",
      body: `Your ${instance.type} request status is now ${workflowStatus}.`,
      type: decision === "APPROVE" ? "SUCCESS" : decision === "REJECT" ? "ERROR" : "WARNING"
    });
  }
  const nextPendingStep = await prisma.workflowStep.findFirst({ where: { workflowInstanceId, status: "PENDING" }, select: { approverUserId: true } });
  if (nextPendingStep?.approverUserId) {
    await createEnterpriseNotification({ userId: nextPendingStep.approverUserId, title: "وصول طلب جديد", body: `A ${instance.type} request is waiting for your approval.`, type: "INFO" });
  }

  return updated;
}
