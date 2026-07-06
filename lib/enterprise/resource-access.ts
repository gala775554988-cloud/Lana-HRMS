export function isEnterpriseResourceAllowed(roles: string[] | undefined, resource: string) {
  const roleSet = new Set(roles ?? []);
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
