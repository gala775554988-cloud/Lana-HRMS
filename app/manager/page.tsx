import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveRoleDashboard } from "@/config/auth";

export default async function ManagerPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  const isManagerOrAdmin = roles.some((role: string) =>
    ["SUPER_ADMIN", "HR_MANAGER", "MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"].includes(role)
  );

  if (!isManagerOrAdmin) {
    redirect(resolveRoleDashboard(roles));
  }

  redirect("/manager/dashboard");
}
