export function canManageEmployeeAccounts(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
}

export function canEditEmployeeAccount(actorRoles: string[], targetRoles: string[], actorId: string, targetId: string) {
  return canManageEmployeeAccounts(actorRoles) && actorId !== targetId &&
    (actorRoles.includes("SUPER_ADMIN") || targetRoles.every(role => role === "EMPLOYEE"));
}
