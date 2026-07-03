import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "app/(hrms)/dashboard/page.tsx",
  "app/(hrms)/[module]/page.tsx",
  "app/(hrms)/[module]/[id]/page.tsx",
  "app/(hrms)/loading.tsx",
  "app/(hrms)/error.tsx",
  "app/not-found.tsx",
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/hr/[module]/route.ts",
  "app/api/hr/[module]/[id]/route.ts",
  "app/api/uploads/route.ts",
  "components/hrms/app-shell.tsx",
  "components/hrms/module-table.tsx",
  "components/hrms/module-form.tsx",
  "components/hrms/empty-state.tsx",
  "components/hrms/loading-skeleton.tsx",
  "components/ui/badge.tsx",
  "config/hrms.ts",
  "config/auth.ts",
  "middleware.ts",
  "prisma/schema.prisma",
  "prisma/seed.ts",
  "Dockerfile",
  "docker-compose.yml",
  "vercel.json",
  ".github/workflows/ci.yml",
  "DEPLOYMENT.md",
  "DEPLOYMENT_GUIDE.md",
  "CHECKLIST.md",
  "PRODUCTION_CHECKLIST.md",
  "TEST_REPORT.md",
  "UI_REPORT.md",
  "UI_IMPROVEMENTS.md",
  "PERFORMANCE_REPORT.md",
  "SECURITY_AUDIT.md",
  "FINAL_AUDIT.md"
];

const requiredModels = [
  "Employee", "Department", "Branch", "Position", "EmploymentType", "Nationality", "AttendanceRecord", "LeaveRequest", "PayrollRun", "PayrollItem", "Loan", "Allowance", "Deduction", "OvertimeRequest", "JobOpening", "Candidate", "PerformanceEvaluation", "TrainingProgram", "Asset", "EmployeeDocument", "EmployeeContract", "ReportDefinition", "Notification", "Announcement", "AuditLog", "AppSetting"
];

const requiredResources = [
  "employees", "departments", "branches", "positions", "attendance", "leave", "payroll", "recruitment", "performance", "training", "assets", "documents", "contracts", "reports", "notifications", "settings", "audit-logs"
];

const forbiddenPatterns = ["TODO", "FIXME", "debugger", "console.log", "require(", "Function"];
const sourceFiles = requiredFiles.filter((file) => /\.(ts|tsx|js|mjs)$/.test(file) && existsSync(file));
const missingFiles = requiredFiles.filter((file) => !existsSync(file));
const schema = readFileSync("prisma/schema.prisma", "utf8");
const authConfig = readFileSync("config/auth.ts", "utf8");
const moduleConfig = readFileSync("config/hrms.ts", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");
const missingModels = requiredModels.filter((model) => !schema.includes(`model ${model}`));
const missingPermissions = requiredResources.filter((resource) => !authConfig.includes(`"${resource}"`));
const missingModules = requiredResources.filter((resource) => !moduleConfig.includes(`permissionResource: "${resource}"`) && !moduleConfig.includes(`key: "${resource}"`));
const forbiddenHits = sourceFiles.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return forbiddenPatterns.filter((pattern) => text.includes(pattern)).map((pattern) => ({ file, pattern }));
});
const middlewareIssues = middleware.includes("@/auth") || !middleware.includes("getToken") ? ["middleware must remain JWT-only and edge safe"] : [];

if (missingFiles.length || missingModels.length || missingPermissions.length || missingModules.length || forbiddenHits.length || middlewareIssues.length) {
  console.error(JSON.stringify({ missingFiles, missingModels, missingPermissions, missingModules, forbiddenHits, middlewareIssues }, null, 2));
  process.exit(1);
}

console.log("HRMS verification passed: files, routes, APIs, modules, Prisma models, RBAC resources, middleware, docs, and deployment assets are present.");