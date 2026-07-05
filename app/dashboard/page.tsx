import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardEntry() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  
  // Check if user has admin/HR privileges
  const isAdmin = roles.some((role: string) => 
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
  );

  if (isAdmin) {
    // Admin goes to HRMS dashboard
    redirect("/(hrms)/dashboard");
  } else {
    // Regular employee goes to employee portal
    redirect("/employee/dashboard");
  }
}
