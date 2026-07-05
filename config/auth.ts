const moduleResources = [
  "dashboard", "employees", "departments", "branches", "positions", "employment-types", "nationalities", "documents", "contracts", "attendance", "leave", "payroll", "loans", "overtime", "allowances", "deductions", "performance", "recruitment", "candidates", "training", "assets", "announcements", "reports", "notifications", "audit-logs", "settings"
] as const;

export const authRoutes = ["/login", "/forgot-password", "/reset-password", "/verify-email"];
export const publicRoutes = [...authRoutes];
export const DEFAULT_LOGIN_REDIRECT = "/dashboard"; // This now redirects based on role in the dashboard page

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
