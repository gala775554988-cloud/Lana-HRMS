import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const WORKFLOW_PATH_TYPES = ["HOSPITAL_PATH", "GENERAL_ADMIN_PATH"] as const;
export type WorkflowPathTypeValue = (typeof WORKFLOW_PATH_TYPES)[number];

const stepSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverId: z.string().min(1, "approverId is required"),
  departmentId: z.string().nullable().optional(),
  roleContext: z.string().min(1, "roleContext is required")
});

export const workflowPathInputSchema = z.object({
  workflowType: z.enum(WORKFLOW_PATH_TYPES),
  workflowName: z.string().min(1, "workflowName is required"),
  // At least one approval level is required -- an empty path can never be saved.
  steps: z.array(stepSchema).min(1, "at least one approval level is required")
});

export type WorkflowPathInput = z.infer<typeof workflowPathInputSchema>;
export type WorkflowPathStep = z.infer<typeof stepSchema>;

export async function getWorkflowPath(workflowType: WorkflowPathTypeValue) {
  const record = await prisma.workflowPathTemplate.findUnique({ where: { workflowType } });
  if (!record) return null;
  const steps = (record.steps as unknown as WorkflowPathStep[]).slice().sort((a, b) => a.stepOrder - b.stepOrder);
  return { id: record.id, workflowType: record.workflowType, workflowName: record.workflowName, steps, updatedAt: record.updatedAt };
}

/**
 * Replaces the entire path for a workflowType inside one transaction: the old
 * record is deleted and the new chain created atomically, so a mid-save
 * failure never leaves the type with a half-written or missing path.
 */
export async function saveWorkflowPath(input: WorkflowPathInput, actorUserId: string) {
  const parsed = workflowPathInputSchema.parse(input);
  const sortedSteps = parsed.steps.slice().sort((a, b) => a.stepOrder - b.stepOrder);

  const saved = await prisma.$transaction(async (tx) => {
    await tx.workflowPathTemplate.deleteMany({ where: { workflowType: parsed.workflowType } });
    return tx.workflowPathTemplate.create({
      data: {
        workflowType: parsed.workflowType,
        workflowName: parsed.workflowName,
        steps: sortedSteps,
        updatedById: actorUserId
      }
    });
  });

  await writeAuditLog({
    actorUserId,
    action: "workflow-path:save",
    entity: "workflowPathTemplate",
    entityId: saved.id,
    metadata: { workflowType: parsed.workflowType, workflowName: parsed.workflowName, stepCount: sortedSteps.length }
  }).catch(() => {});

  return { id: saved.id, workflowType: saved.workflowType, workflowName: saved.workflowName, steps: sortedSteps, updatedAt: saved.updatedAt };
}
