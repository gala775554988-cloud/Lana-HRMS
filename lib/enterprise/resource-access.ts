export function isEnterpriseResourceAllowed(roles: string[] | undefined, resource: string) {
  const roleSet = new Set(roles ?? []);
  // The system audit log is Super-Admin-only by design (an immutable
  // accountability trail) -- deliberately excluded from the HR_MANAGER
  // bypass every other enterprise resource gets, even though HR_MANAGER's
  // seeded RolePermission rows still nominally include read/manage:audit-logs.
  if (resource === "audit-logs") return roleSet.has("SUPER_ADMIN");
  if (roleSet.has("SUPER_ADMIN") || roleSet.has("HR_MANAGER")) return true;

  if (roleSet.has("PAYROLL_MANAGER")) {
    return ["dashboard", "payroll"].includes(resource);
  }

  if (roleSet.has("INSURANCE_OFFICER")) {
    return ["dashboard", "documents", "reports"].includes(resource);
  }

  if (roleSet.has("RESIDENCY_OFFICER")) {
    return ["dashboard", "documents", "reports"].includes(resource);
  }

  return true;
}
