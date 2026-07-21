import { hasPermission } from "@/lib/rbac";

/** Shared by every custom payroll route (run/route.ts, run/[id]/route.ts,
 * run/[id]/duplicate/route.ts, dashboard/route.ts, activity/route.ts) --
 * previously each file redefined its own copy of these checks. hasPermission's
 * "manage" action already aliases to create/edit/delete/approve/reject (see
 * lib/rbac.ts), so a user granted just "edit:payroll" via the permissions UI
 * (now grantable since payroll joined GRANULAR_RESOURCES) already satisfies
 * canManagePayroll without any change here -- this consolidation only removes
 * the duplication, it doesn't change who passes. */
export function canViewPayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("HR_MANAGER") ||
    roles.includes("PAYROLL_OFFICER") ||
    hasPermission(permissions, { action: "read", resource: "payroll" }) ||
    hasPermission(permissions, { action: "manage", resource: "payroll" })
  );
}

export function canManagePayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("HR_MANAGER") ||
    roles.includes("PAYROLL_OFFICER") ||
    hasPermission(permissions, { action: "manage", resource: "payroll" })
  );
}

/** Only HR_MANAGER/SUPER_ADMIN can approve or disburse a run -- PAYROLL_OFFICER
 * (and anyone with plain manage:payroll) can create/submit/cancel a DRAFT, but
 * the second pair of eyes on money leaving the company is a hard role check,
 * not just a permission flag. This is a deliberately simpler two-tier
 * approval (create/submit -> approve/pay) rather than the generic per-employee
 * WorkflowInstance engine, which is anchored to a single employee's org unit
 * and doesn't fit a run spanning many employees at once. */
export function canApprovePayroll(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
}
