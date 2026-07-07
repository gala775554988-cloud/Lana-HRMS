const moduleResources = [
  "dashboard", "employees", "departments", "branches", "positions", "employment-types", "nationalities", "documents", "contracts", "attendance", "leave", "payroll", "loans", "overtime", "allowances", "deductions", "performance", "recruitment", "candidates", "training", "assets", "announcements", "reports", "notifications", "audit-logs", "settings"
] as const;

export const authRoutes = ["/login", "/forgot-password", "/reset-password", "/verify-email"];
export const publicRoutes = [...authRoutes];
export const DEFAULT_LOGIN_REDIRECT = "/employee/dashboard"; // Safe default (root page overrides for role-based redirect)

export function resolveRoleDashboard(userRoles?: string[] | null): string {
  if (!userRoles || !Array.isArray(userRoles)) return DEFAULT_LOGIN_REDIRECT;
  if (userRoles.includes("SUPER_ADMIN")) {
    return "/admin/dashboard";
  }
  if (userRoles.some((role) => ["HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "HR"].includes(role))) {
    return "/hr/dashboard";
  }
  if (userRoles.some((role) => ["MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"].includes(role))) {
    return "/manager/dashboard";
  }
  return "/employee/dashboard";
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
