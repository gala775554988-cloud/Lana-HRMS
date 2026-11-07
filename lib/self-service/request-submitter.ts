import { hasPermission } from "@/lib/rbac";
import { canAccessEmployeeId, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";

type Actor = { id: string; roles?: string[]; permissions?: string[] };

export function canSubmitOnBehalf(actor: Actor) {
  const roles = actor.roles ?? [];
  return isEnterpriseResourceAllowed(roles, "requests") &&
    (roles.includes("HR_MANAGER") || hasPermission(actor.permissions, { action: "create", resource: "requests" }, roles));
}

export async function canSubmitForEmployee(actor: Actor, employeeId: string) {
  if (!canSubmitOnBehalf(actor)) return false;
  return canAccessEmployeeId(employeeId, await getAccessProfile(actor.id, actor.roles ?? []));
}
