import { prisma } from "@/lib/prisma";
import type { ApprovalEntityType } from "@prisma/client";

export type ResolvedApprover = {
  userId: string;
  capabilities: string[];
  isMandatory: boolean;
  stageName: string | null;
};

const DEFAULT_COMPANY_CODE = "MAIN";
let cachedDefaultCompanyId: string | null = null;

async function getDefaultCompanyId() {
  if (cachedDefaultCompanyId) return cachedDefaultCompanyId;
  const company = await prisma.company.findUnique({ where: { code: DEFAULT_COMPANY_CODE }, select: { id: true } });
  cachedDefaultCompanyId = company?.id ?? null;
  return cachedDefaultCompanyId;
}

// Priority order when an employee belongs to more than one entity type at
// once (e.g. a hospital employee also has a department) -- the most
// specific/operational entity wins. Admins configure exactly one active
// path per (company, entityType, entityId, requestType); if none exists
// for the employee's entity at all, the request auto-completes (no fixed
// default chain, per spec -- "لا تستخدم مراحل ثابتة").
const ENTITY_PRIORITY: ApprovalEntityType[] = ["HOSPITAL", "DEPARTMENT", "BRANCH", "PROJECT"];

/** Resolves the configured, unlimited-stage ApprovalPath for `employeeId`'s
 * request of type `requestType`. Returns the FULL ordered stage list
 * (mandatory and optional) -- callers that create WorkflowStep rows are
 * responsible for auto-resolving optional (VIEW-only) stages immediately,
 * see createEnterpriseWorkflow in lib/enterprise/workflow.ts. */
export async function resolveApprovalChain(employeeId: string, requestType?: string): Promise<ResolvedApprover[]> {
  if (!requestType) return [];
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, userId: true, companyId: true, hospitalId: true, departmentId: true, branchId: true, projectId: true }
  });
  if (!employee) return [];

  const companyId = employee.companyId ?? (await getDefaultCompanyId());
  if (!companyId) return [];

  const normalizedType = requestType.toUpperCase();
  const entityByType: Record<ApprovalEntityType, string | null> = {
    HOSPITAL: employee.hospitalId,
    DEPARTMENT: employee.departmentId,
    BRANCH: employee.branchId,
    PROJECT: employee.projectId
  };

  let path: Awaited<ReturnType<typeof findPath>> = null;
  for (const entityType of ENTITY_PRIORITY) {
    const entityId = entityByType[entityType];
    if (!entityId) continue;
    path = await findPath(companyId, entityType, entityId, normalizedType);
    if (path) break;
  }
  if (!path) return [];

  const seen = new Set<string>();
  const result: ResolvedApprover[] = [];
  for (const stage of path.stages) {
    const userId = stage.approverEmployee.userId;
    if (!userId || userId === employee.userId || seen.has(userId)) continue;
    seen.add(userId);
    result.push({
      userId,
      capabilities: stage.isMandatory ? ["VIEW", "APPROVE", "REJECT"] : ["VIEW"],
      isMandatory: stage.isMandatory,
      stageName: stage.name
    });
  }
  return result;
}

function findPath(companyId: string, entityType: ApprovalEntityType, entityId: string, requestType: string) {
  return prisma.approvalPath.findFirst({
    where: { companyId, entityType, entityId, requestType, isActive: true },
    include: { stages: { orderBy: { order: "asc" }, include: { approverEmployee: { select: { userId: true } } } } }
  });
}
