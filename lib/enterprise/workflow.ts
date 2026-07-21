import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { resolveApprovalChain } from "@/lib/enterprise/hierarchy";
import { createEnterpriseNotification, notifyUsers } from "@/lib/enterprise/notifications";
import { recordLeaveApprovalUsage } from "@/lib/employee/leave-balance";
import { recordLeaveTypeApprovalUsage } from "@/lib/enterprise/leave-engine";

export async function createEnterpriseWorkflow(employeeId: string, type: string, entityId: string) {
  const approvers = await resolveApprovalChain(employeeId, type.toLowerCase());
  // Optional stages (isMandatory: false) never block progression -- they're
  // auto-resolved to APPROVED right away (still recorded, VIEW-only) so the
  // chain moves straight to the first mandatory stage. If every stage is
  // optional (or there are none), the whole request auto-completes.
  const firstMandatoryIndex = approvers.findIndex((approver) => approver.isMandatory);
  const hasMandatoryStage = firstMandatoryIndex !== -1;

  const instance = await prisma.workflowInstance.create({
    data: {
      employeeId,
      type,
      entityId,
      status: approvers.length ? (hasMandatoryStage ? "PENDING" : "COMPLETED") : "COMPLETED",
      currentStep: hasMandatoryStage ? firstMandatoryIndex + 1 : approvers.length ? approvers.length + 1 : 0
    }
  });

  if (approvers.length) {
    const now = new Date();
    await prisma.workflowStep.createMany({
      data: approvers.map((approver, index) => ({
        workflowInstanceId: instance.id,
        step: index + 1,
        approverUserId: approver.userId,
        status: !approver.isMandatory ? "APPROVED" : index === firstMandatoryIndex ? "PENDING" : "WAITING",
        capabilities: approver.capabilities,
        ...(!approver.isMandatory ? { approvedAt: now, comments: "تمت الموافقة تلقائياً (مرحلة اختيارية)" } : {})
      }))
    });
    if (hasMandatoryStage) {
      const firstApprover = approvers[firstMandatoryIndex];
      await notifyUsers([firstApprover.userId], "وصول طلب جديد", `New ${type} request is waiting for your approval.`, "INFO", `/approvals?tab=inbox&highlight=${instance.id}`);
    }
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (employee?.userId) {
    await createEnterpriseNotification({
      userId: employee.userId,
      title: hasMandatoryStage ? "تم إرسال الطلب" : "تم اعتماد الطلب",
      body: hasMandatoryStage ? `Your ${type} request has been submitted.` : `Your ${type} request was approved automatically.`,
      type: hasMandatoryStage ? "INFO" : "SUCCESS",
      link: `/approvals?tab=outbox&highlight=${instance.id}`
    });
  }

  await writeAuditLog({
    actorUserId: employee?.userId ?? undefined,
    action: "workflow:submit",
    entity: "workflowInstance",
    entityId: instance.id,
    metadata: { type, employeeId, entityId, approverCount: approvers.length, autoApproved: !hasMandatoryStage }
  });

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

  if (currentStep.approverUserId && currentStep.approverUserId !== actorUserId) {
    // Dynamic Self-Healing Auth Check: re-verify if actor is live legitimate approver
    const liveChain = await resolveApprovalChain(instance.employeeId, instance.type.toLowerCase());
    const liveApprover = liveChain[instance.currentStep - 1];
    if (!liveApprover || liveApprover.userId !== actorUserId) {
      throw new Error("Forbidden");
    }
    await prisma.workflowStep.update({
      where: { id: currentStep.id },
      data: { approverUserId: actorUserId, capabilities: liveApprover.capabilities || currentStep.capabilities || ["VIEW", "APPROVE", "REJECT"] }
    });
  }

  const capabilities = currentStep.capabilities?.length ? currentStep.capabilities : ["VIEW", "APPROVE", "REJECT"];
  if (decision === "APPROVE" && !capabilities.includes("APPROVE")) throw new Error("Forbidden");
  if (decision === "REJECT" && !capabilities.includes("REJECT")) throw new Error("Forbidden");
  if (decision === "RETURN" && !capabilities.includes("APPROVE") && !capabilities.includes("REJECT")) throw new Error("Forbidden");

  // A rejection reason is mandatory for transparency -- enforced here (not
  // just in the client UI) so the requirement can't be bypassed by calling
  // the API directly.
  if (decision === "REJECT" && !comments?.trim()) throw new Error("سبب الرفض مطلوب");

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
    // Optional stages after this one were already auto-resolved to APPROVED
    // at creation time (see createEnterpriseWorkflow) -- only a still-"WAITING"
    // step is a real next stop; skipping past already-decided ones this way
    // is what makes optional stages never block progression.
    const nextStep = instance.steps.find((step) => step.step > instance.currentStep && step.status === "WAITING");
    if (nextStep) {
      currentStepNumber = nextStep.step;
      const liveChain = await resolveApprovalChain(instance.employeeId, instance.type.toLowerCase());
      const liveApproverForNext = liveChain[currentStepNumber - 1];
      const updatedApproverUserId = liveApproverForNext?.userId || nextStep.approverUserId;
      const updatedCapabilities = liveApproverForNext?.capabilities || nextStep.capabilities || ["VIEW", "APPROVE", "REJECT"];

      await prisma.workflowStep.update({
        where: { id: nextStep.id },
        data: {
          status: "PENDING",
          approverUserId: updatedApproverUserId,
          capabilities: updatedCapabilities
        }
      });
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

  if (instance.type === "LEAVE") {
    const nextLeaveStatus = workflowStatus === "COMPLETED" ? "APPROVED" : workflowStatus === "REJECTED" ? "REJECTED" : workflowStatus === "RETURNED" ? "PENDING" : undefined;
    if (nextLeaveStatus) {
      const updatedLeave = await prisma.leaveRequest
        .update({ where: { id: instance.entityId }, data: { status: nextLeaveStatus as any, decidedAt: new Date(), decisionNote: comments } })
        .catch(() => null);
      if (nextLeaveStatus === "APPROVED" && updatedLeave) {
        await recordLeaveApprovalUsage(instance.employeeId, Number(updatedLeave.days)).catch(() => null);
        await recordLeaveTypeApprovalUsage(instance.employeeId, updatedLeave.leaveTypeId, Number(updatedLeave.days), updatedLeave.startDate).catch(() => null);
      }
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
      type: decision === "APPROVE" ? "SUCCESS" : decision === "REJECT" ? "ERROR" : "WARNING",
      link: `/approvals?tab=outbox&highlight=${workflowInstanceId}`
    });
  }
  const nextPendingStep = await prisma.workflowStep.findFirst({ where: { workflowInstanceId, status: "PENDING" }, select: { approverUserId: true } });
  if (nextPendingStep?.approverUserId) {
    await createEnterpriseNotification({ userId: nextPendingStep.approverUserId, title: "وصول طلب جديد", body: `A ${instance.type} request is waiting for your approval.`, type: "INFO", link: `/approvals?tab=inbox&highlight=${workflowInstanceId}` });
  }

  return updated;
}

/**
 * Auto-Heal Dynamic Pipeline Engine:
 * Immediately updates the current approver (`approverUserId`) on all PENDING workflow steps
 * for an employee (or all employees in a hospital) whenever their hierarchy, permissions,
 * or hospital supervisor assignments change via `EnterpriseAccessManager` or `WorkflowManager`.
 */
export async function autoHealPendingWorkflowsForEmployee(options: { employeeId?: string; hospitalId?: string }) {
  try {
    const where: Record<string, unknown> = { status: "PENDING" };
    if (options.employeeId) {
      where.employeeId = options.employeeId;
    } else if (options.hospitalId) {
      const emps = await prisma.employee.findMany({ where: { hospitalId: options.hospitalId }, select: { id: true } });
      const empIds = emps.map((e) => e.id);
      if (!empIds.length) return { healed: 0 };
      where.employeeId = { in: empIds };
    } else {
      return { healed: 0 };
    }

    const pendingInstances = await prisma.workflowInstance.findMany({
      where,
      include: { steps: { orderBy: { step: "asc" } } }
    });

    let healedCount = 0;
    for (const instance of pendingInstances) {
      const currentStep = instance.steps.find((step) => step.step === instance.currentStep && step.status === "PENDING");
      if (!currentStep) continue;

      const liveChain = await resolveApprovalChain(instance.employeeId, instance.type.toLowerCase());
      const liveApprover = liveChain[instance.currentStep - 1];
      if (liveApprover && liveApprover.userId && liveApprover.userId !== currentStep.approverUserId) {
        await prisma.workflowStep.update({
          where: { id: currentStep.id },
          data: {
            approverUserId: liveApprover.userId,
            capabilities: liveApprover.capabilities || currentStep.capabilities || ["VIEW", "APPROVE", "REJECT"]
          }
        });
        healedCount++;
      }
    }
    return { healed: healedCount };
  } catch {
    return { healed: 0 };
  }
}
