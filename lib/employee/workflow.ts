import { prisma } from "@/lib/prisma";

export async function createWorkflow(employeeId: string, type: string, entityId: string) {
  // Create workflow instance
  const instance = await prisma.workflowInstance.create({
    data: {
      employeeId,
      type,
      entityId,
      status: "PENDING",
      currentStep: 1,
    }
  });

  // Standard approval chain (can be made configurable later)
  const steps = [
    { step: 1, role: "MANAGER" },
    { step: 2, role: "HR" },
    { step: 3, role: "FINANCE" },
  ];

  await prisma.workflowStep.createMany({
    data: steps.map(s => ({
      workflowInstanceId: instance.id,
      step: s.step,
      status: "PENDING",
    }))
  });

  return instance;
}

export async function approveStep(workflowInstanceId: string, approverUserId: string, comments?: string) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
    include: { steps: true }
  });

  if (!instance) return null;

  const currentStep = instance.steps.find(s => s.step === instance.currentStep);
  if (!currentStep) return null;

  // Approve current step
  await prisma.workflowStep.update({
    where: { id: currentStep.id },
    data: {
      status: "APPROVED",
      approverUserId,
      approvedAt: new Date(),
      comments,
    }
  });

  const nextStep = instance.currentStep + 1;

  if (nextStep > 3) {
    // Complete workflow
    await prisma.workflowInstance.update({
      where: { id: workflowInstanceId },
      data: { status: "COMPLETED", currentStep: nextStep }
    });
  } else {
    await prisma.workflowInstance.update({
      where: { id: workflowInstanceId },
      data: { currentStep: nextStep }
    });
  }

  return true;
}
