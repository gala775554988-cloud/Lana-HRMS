import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveRoleDashboard } from "@/config/auth";

export default async function HrPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  const isHrOrAdmin = roles.some((role: string) =>
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "HR"].includes(role)
  );

  if (!isHrOrAdmin) {
    redirect(resolveRoleDashboard(roles));
  }

  redirect("/hr/dashboard");
}
