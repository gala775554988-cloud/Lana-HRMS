import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardRedirect() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  const isEmployee = roles.includes("EMPLOYEE") || roles.length === 0;

  if (isEmployee) {
    redirect("/employee/dashboard");
  }

  // HR, Admin, Manager → go to the new HRMS dashboard
  redirect("/(hrms)/dashboard");
}
