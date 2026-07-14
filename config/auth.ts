const moduleResources = [
  "dashboard", "employees", "departments", "branches", "positions", "employment-types", "nationalities", "documents", "contracts", "attendance", "leave", "payroll", "loans", "overtime", "allowances", "deductions", "performance", "recruitment", "candidates", "training", "assets", "announcements", "reports", "notifications", "audit-logs", "settings", "shifts"
] as const;

export const authRoutes = ["/login", "/forgot-password", "/reset-password", "/verify-email"];
export const publicRoutes = [...authRoutes];
export const DEFAULT_LOGIN_REDIRECT = "/employee/dashboard";

export function resolveRoleDashboard(userRoles?: string[] | null): string {
  if (!userRoles || !Array.isArray(userRoles)) return DEFAULT_LOGIN_REDIRECT;
  const roleSet = new Set(userRoles);

  // SUPER_ADMIN is always sent to the HR administration area.
  if (roleSet.has("SUPER_ADMIN")) return "/employees";

  // Any normal user that has EMPLOYEE must land in the Employee Portal, even if
  // a position-title inference added HR_MANAGER/DEPARTMENT_MANAGER. This was the
  // real reason some employee accounts still rendered the old HR layout.
  if (roleSet.has("EMPLOYEE")) return "/employee/dashboard";

  const isAdminOrManager = userRoles.some((role) =>
    ["HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER", "HR", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"].includes(role)
  );
  if (isAdminOrManager) return "/employees";
  return DEFAULT_LOGIN_REDIRECT;
}

export const permissions = Object.fromEntries(
  moduleResources.flatMap((resource) => [
    [resource + ":read", { action: "read", resource }],
    [resource + ":manage", { action: "manage", resource }]
  ])
) as Record<string, { action: string; resource: string }>;

export const roles = {
  superAdmin: "SUPER_ADMIN",
  hrManager: "HR_MANAGER",
  payrollManager: "PAYROLL_MANAGER",
  recruiter: "RECRUITER",
  employee: "EMPLOYEE"
} as const;

export const rbacResources = moduleResources;
