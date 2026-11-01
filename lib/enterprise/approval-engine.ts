import { prisma } from "@/lib/prisma";
import type { ApprovalEntityType } from "@prisma/client";
import { normalizeRequestType, type RoutingRule } from "@/config/request-routing";
import { ApprovalRoutingError, routingRuleFor } from "./request-routing-policy";
import { resolveDynamicRouting } from "./dynamic-approval-routing";

export type ResolvedApprover = {
  userId: string;
  capabilities: string[];
  isMandatory: boolean;
  stageName: string | null;
  slaHours?: number;
};

const DEFAULT_COMPANY_CODE = "MAIN";
let cachedDefaultCompanyId: string | null = null;

async function getDefaultCompanyId() {
  if (cachedDefaultCompanyId) return cachedDefaultCompanyId;
  const company = await prisma.company.findUnique({ where: { code: DEFAULT_COMPANY_CODE }, select: { id: true } });
  cachedDefaultCompanyId = company?.id ?? null;
  return cachedDefaultCompanyId;
}

// Explicit organizational paths take precedence over the configurable company defaults.
const ENTITY_PRIORITY: ApprovalEntityType[] = ["HOSPITAL", "DEPARTMENT", "BRANCH", "PROJECT"];

/** Resolves the configured, unlimited-stage ApprovalPath for `employeeId`'s
 * request of type `requestType`. Returns the FULL ordered stage list
 * (mandatory and optional) -- callers that create WorkflowStep rows are
 * responsible for auto-resolving optional (VIEW-only) stages immediately,
 * see createEnterpriseWorkflow in lib/enterprise/workflow.ts. */
export async function resolveApprovalChain(employeeId: string, requestType?: string, ruleOverride?: RoutingRule): Promise<ResolvedApprover[]> {
  if (!requestType) throw new ApprovalRoutingError("نوع الطلب مطلوب لتحديد المسار.");
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, userId: true, companyId: true, hospitalId: true, departmentId: true, branchId: true, projectId: true, managerId: true }
  });
  if (!employee) throw new ApprovalRoutingError("سجل الموظف غير موجود.");

  const companyId = employee.companyId ?? (await getDefaultCompanyId());


  const normalizedType = normalizeRequestType(requestType);
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
    if (!companyId) continue;
    path = await findPath(companyId, entityType, entityId, normalizedType);
    if (path) break;
  }
  const rule = ruleOverride ?? await routingRuleFor(normalizedType, companyId);
  if (!path) return (await resolveDynamicRouting({ ...employee, companyId }, rule)).approvers;

  const seen = new Set<string>();
  const result: ResolvedApprover[] = [];
  for (const stage of path.stages) {
    const userId = stage.approverEmployee.userId;
    if ((!userId || !stage.approverEmployee.user?.isActive || ["INACTIVE", "TERMINATED"].includes(stage.approverEmployee.status)) && stage.isMandatory) throw new ApprovalRoutingError("يوجد معتمد غير نشط أو غير مرتبط بحساب في المسار الخاص. راجع إعداداته.");
    if (!userId || !stage.approverEmployee.user?.isActive || ["INACTIVE", "TERMINATED"].includes(stage.approverEmployee.status) || userId === employee.userId) continue;
    if (seen.has(userId)) {
      const existing = result.find(item => item.userId === userId)!;
      if (stage.isMandatory) { existing.isMandatory = true; existing.capabilities = ["VIEW", "APPROVE", "REJECT"]; }
      continue;
    }
    seen.add(userId);
    result.push({
      userId,
      capabilities: stage.isMandatory ? ["VIEW", "APPROVE", "REJECT"] : ["VIEW"],
      isMandatory: stage.isMandatory,
      stageName: stage.name,
      slaHours: rule.slaHours
    });
  }
  if (!result.some(stage => stage.isMandatory)) return (await resolveDynamicRouting({ ...employee, companyId }, { ...rule, mode: "HR_DIRECT" })).approvers;
  return result;
}

function findPath(companyId: string, entityType: ApprovalEntityType, entityId: string, requestType: string) {
  return prisma.approvalPath.findFirst({
    where: { companyId, entityType, entityId, requestType, isActive: true },
    include: { stages: { orderBy: { order: "asc" }, include: { approverEmployee: { select: { userId: true, status: true, user: { select: { isActive: true } } } } } } }
  });
}
