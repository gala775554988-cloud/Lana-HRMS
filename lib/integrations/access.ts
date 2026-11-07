import { hasPermission } from "@/lib/rbac";

export function canManageIntegration(user: { roles?: string[]; permissions?: string[] }) {
  const roles = user.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") ||
    hasPermission(user.permissions, { action: "manage", resource: "settings" }, roles);
}
