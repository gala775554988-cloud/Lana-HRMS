const moduleResources = [
  "dashboard", "employees", "departments", "branches", "positions", "employment-types", "nationalities", "documents", "contracts", "attendance", "leave", "payroll", "loans", "overtime", "allowances", "deductions", "performance", "recruitment", "candidates", "training", "assets", "announcements", "reports", "notifications", "audit-logs", "settings", "shifts"
] as const;

export const authRoutes = ["/login", "/forgot-password", "/reset-password", "/verify-email"];
export const publicRoutes = [...authRoutes];
export const DEFAULT_LOGIN_REDIRECT = "/employee/dashboard";

const HR_DASHBOARD_ROLES = ["HR_MANAGER", "HR", "RECRUITER"];
const MANAGER_DASHBOARD_ROLES = ["MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"];

export function resolveRoleDashboard(
  userRoles?: string[] | null,
  hasGrantedAdminAccess = false
): string {
  if (!userRoles || !Array.isArray(userRoles)) return DEFAULT_LOGIN_REDIRECT;
  const roleSet = new Set(userRoles.map((role) => role.trim().toUpperCase()));

  // SUPER_ADMIN is always sent to the Central Executive Dashboard.
  if (roleSet.has("SUPER_ADMIN")) return "/dashboard";

  // Resolve privileged roles before EMPLOYEE. Most staff with an HR or
  // management role also carry EMPLOYEE for self-service; the reverse order
  // accidentally sends these users to a portal that requires an Employee row.
  if (roleSet.has("HR_MANAGER") || roleSet.has("HR") || roleSet.has("RECRUITER")) {
    return "/hr/dashboard";
  }
  if (roleSet.has("PAYROLL_MANAGER") || roleSet.has("PAYROLL_OFFICER")) {
    return "/payroll";
  }
  if (MANAGER_DASHBOARD_ROLES.some((role) => roleSet.has(role))) {
    return "/manager/dashboard";
  }

  // Per-user grants are computed from server-authoritative permissions,
  // never inferred from a username, email, or an unlinked employee profile.
  if (hasGrantedAdminAccess) return "/dashboard";

  // Self-service is the only default for employees and unknown roles.
  // Never promote an unknown role to administrator.
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
