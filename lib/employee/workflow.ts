import { prisma } from "@/lib/prisma";
import { createEnterpriseWorkflow, decideWorkflowStep } from "@/lib/enterprise/workflow";

export async function createWorkflow(employeeId: string, type: string, entityId: string) {
  return createEnterpriseWorkflow(employeeId, type, entityId);
}

export async function approveStep(workflowInstanceId: string, approverUserId: string, comments?: string) {
  return decideWorkflowStep({ workflowInstanceId, actorUserId: approverUserId, decision: "APPROVE", comments });
}

export async function rejectStep(workflowInstanceId: string, approverUserId: string, comments?: string) {
  return decideWorkflowStep({ workflowInstanceId, actorUserId: approverUserId, decision: "REJECT", comments });
}

export async function returnStep(workflowInstanceId: string, approverUserId: string, comments?: string) {
  return decideWorkflowStep({ workflowInstanceId, actorUserId: approverUserId, decision: "RETURN", comments });
}

export async function getPendingApprovalsForUser(userId: string) {
  return prisma.workflowInstance.findMany({
    where: { steps: { some: { approverUserId: userId, status: "PENDING" } } },
    include: {
      employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, departmentId: true, branchId: true } },
      steps: { orderBy: { step: "asc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}
