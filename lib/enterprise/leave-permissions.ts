import { hasPermission } from "@/lib/rbac";

/** Shared by every custom leave route (dashboard, calendar, absentee-report,
 * reports/exports). "leave" joined GRANULAR_RESOURCES alongside payroll/
 * insurance, so a user granted just "edit:leave" already satisfies
 * canManageLeave via hasPermission's "manage" aliasing (see lib/rbac.ts). */
export function canViewLeave(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("HR_MANAGER") ||
    roles.includes("BRANCH_MANAGER") ||
    roles.includes("DEPARTMENT_MANAGER") ||
    roles.includes("SUPERVISOR") ||
    roles.includes("REQUESTS_OFFICER") ||
    hasPermission(permissions, { action: "read", resource: "leave" }) ||
    hasPermission(permissions, { action: "manage", resource: "leave" })
  );
}

export function canManageLeave(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("HR_MANAGER") ||
    hasPermission(permissions, { action: "manage", resource: "leave" })
  );
}
