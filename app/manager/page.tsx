import { redirectToRoleGatedDashboard } from "@/lib/auth/role-guard";

export default async function ManagerPage() {
  await redirectToRoleGatedDashboard({
    allowedRoles: ["SUPER_ADMIN", "HR_MANAGER", "MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"],
    targetPath: "/manager/dashboard",
  });
}
