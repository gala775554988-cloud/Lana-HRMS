export const REQUEST_CATEGORIES = [
  { code: "RESUMPTION", label: "مباشرة العمل" }, { code: "RESIDENCY", label: "الإقامة" },
  { code: "OVERTIME", label: "العمل الإضافي" }, { code: "LOAN", label: "السلف" },
  { code: "LETTER", label: "الخطابات" }, { code: "LEAVE", label: "الإجازات" },
  { code: "EXPENSE", label: "المصروفات" }, { code: "DOCUMENT", label: "الوثائق" },
  { code: "DELEGATION", label: "الانتدابات" }, { code: "CUSTODY", label: "العهد" },
] as const;
export type RoutingStageKind = "DIRECT_MANAGER" | "MANAGER_CHAIN" | "HR" | "EMPLOYEE";
export type RoutingStage = { kind: RoutingStageKind; employeeId?: string; name?: string };
export type RoutingRule = { requestType: string; companyId: string | null; mode: "MANAGER_HR" | "HIERARCHY_HR" | "HR_DIRECT" | "CUSTOM"; hrEmployeeId: string | null; maxManagerLevels: number; slaHours: number; stages: RoutingStage[] };
export const STAGE_LABELS: Record<RoutingStageKind, string> = { DIRECT_MANAGER: "المدير المباشر", MANAGER_CHAIN: "التسلسل الإداري", HR: "الموارد البشرية", EMPLOYEE: "معتمد محدد" };
export function normalizeRequestType(type: string) { const value = type.trim().toUpperCase(); return value === "DOCUMENTS" ? "DOCUMENT" : value; }
export function stagesForRule(rule: RoutingRule): RoutingStage[] {
  if (rule.mode === "HR_DIRECT") return [{ kind: "HR" }];
  if (rule.mode === "HIERARCHY_HR") return [{ kind: "MANAGER_CHAIN" }, { kind: "HR" }];
  if (rule.mode === "MANAGER_HR") return [{ kind: "DIRECT_MANAGER" }, { kind: "HR" }];
  return rule.stages;
}
export function defaultRoutingRule(requestType: string, companyId: string | null = null): RoutingRule {
  return { requestType, companyId, mode: ["LETTER", "DOCUMENT", "RESIDENCY"].includes(requestType) ? "HR_DIRECT" : "MANAGER_HR", hrEmployeeId: null, maxManagerLevels: 10, slaHours: 48, stages: [] };
}
export function canManageApprovalRouting(roles: string[] = [], permissions: string[] = []) {
  return roles.some(role => ["SUPER_ADMIN", "HR_MANAGER"].includes(role)) || permissions.some(permission => ["*:*", "manage:permissions", "manage:settings"].includes(permission.toLowerCase()));
}
