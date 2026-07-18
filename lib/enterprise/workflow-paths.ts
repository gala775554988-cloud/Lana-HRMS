import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateEffectivePermissions } from "@/lib/enterprise/permissions";

export const WORKFLOW_PATH_TYPES = ["HOSPITAL_PATH", "GENERAL_ADMIN_PATH"] as const;
export type WorkflowPathTypeValue = (typeof WORKFLOW_PATH_TYPES)[number];

const stepSchema = z.object({
  stepOrder: z.number().int().positive(),
  // Real, resolvable Employee.userId -- every level names a specific person,
  // selected via UserSearchSelect in the workflow builder.
  approverId: z.string().min(1, "يجب اختيار الموظف المُعتمِد لكل مستوى"),
  // "<department|branch|hospital>:<id>" -- which org unit this approval
  // level applies to.
  departmentId: z.string().min(1, "يجب اختيار الجهة (إدارة/فرع/مستشفى) لكل مستوى"),
  // Free-text role/title label, purely cosmetic display context.
  roleContext: z.string().optional().default(""),
  // Denormalized display names, purely cosmetic -- approval routing always
  // resolves via approverId/departmentId, never these labels.
  approverLabel: z.string().optional(),
  orgUnitLabel: z.string().optional()
});

export const workflowPathInputSchema = z.object({
  workflowType: z.enum(WORKFLOW_PATH_TYPES),
  workflowName: z.string().min(1, "workflowName is required"),
  // At least one approval level is required -- an empty path can never be saved.
  steps: z.array(stepSchema).min(1, "يجب أن يحتوي المسار على مستوى موافقة واحد على الأقل")
});

export type WorkflowPathInput = z.infer<typeof workflowPathInputSchema>;
export type WorkflowPathStep = z.infer<typeof stepSchema>;

export async function getWorkflowPath(workflowType: WorkflowPathTypeValue) {
  const record = await prisma.workflowPathTemplate.findUnique({ where: { workflowType } });
  if (!record) return null;
  const steps = (record.steps as unknown as WorkflowPathStep[]).slice().sort((a, b) => a.stepOrder - b.stepOrder);
  return { id: record.id, workflowType: record.workflowType, workflowName: record.workflowName, steps, updatedAt: record.updatedAt };
}

function approverIdsOf(steps: WorkflowPathStep[]): string[] {
  return steps.filter((step) => step.approverId).map((step) => step.approverId);
}

/**
 * Every userId currently named as an approver in any active workflow path,
 * across both path types -- every level names a real, specific employee now
 * (see stepSchema), so this is simply every step's approverId. This is the
 * live source of truth for "requests" access derived from workflow-path
 * membership -- see mergeEffectivePermissions in lib/enterprise/permissions.ts,
 * which grants read:requests/manage:requests to anyone in this set without
 * writing anything into the general per-user grants store. Removing someone
 * from a path takes effect the moment this set no longer contains them -- no
 * separate revoke bookkeeping needed.
 */
export async function getWorkflowPathApproverUserIds(): Promise<Set<string>> {
  const records = await prisma.workflowPathTemplate.findMany({ select: { steps: true } });
  const ids = new Set<string>();
  for (const record of records) {
    for (const id of approverIdsOf(record.steps as unknown as WorkflowPathStep[])) ids.add(id);
  }
  return ids;
}

/**
 * Replaces the entire path for a workflowType inside one transaction: the old
 * record is deleted and the new chain created atomically, so a mid-save
 * failure never leaves the type with a half-written or missing path.
 */
export async function saveWorkflowPath(input: WorkflowPathInput, actorUserId: string) {
  const parsed = workflowPathInputSchema.parse(input);
  const sortedSteps = parsed.steps.slice().sort((a, b) => a.stepOrder - b.stepOrder);

  const existing = await prisma.workflowPathTemplate.findUnique({ where: { workflowType: parsed.workflowType } });
  const previousApproverIds = existing ? approverIdsOf(existing.steps as unknown as WorkflowPathStep[]) : [];

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

  // Whether someone was just added as, or just removed as, a CUSTOM_APPROVER,
  // their cached effective permissions (which fold in workflow-path-derived
  // "requests" access) are stale the moment this transaction commits --
  // invalidate immediately instead of waiting out the 30s cache TTL, so grant
  // and revoke both take effect on their very next request.
  const newApproverIds = approverIdsOf(sortedSteps);
  const affectedUserIds = new Set([...previousApproverIds, ...newApproverIds]);
  for (const userId of affectedUserIds) invalidateEffectivePermissions(userId);

  await writeAuditLog({
    actorUserId,
    action: "workflow-path:save",
    entity: "workflowPathTemplate",
    entityId: saved.id,
    metadata: { workflowType: parsed.workflowType, workflowName: parsed.workflowName, stepCount: sortedSteps.length }
  }).catch(() => {});

  return { id: saved.id, workflowType: saved.workflowType, workflowName: saved.workflowName, steps: sortedSteps, updatedAt: saved.updatedAt };
}
