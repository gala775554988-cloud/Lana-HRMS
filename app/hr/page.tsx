import { redirectToRoleGatedDashboard } from "@/lib/auth/role-guard";

export default async function HrPage() {
  await redirectToRoleGatedDashboard({
    allowedRoles: ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "HR"],
    targetPath: "/hr/dashboard",
  });
}
