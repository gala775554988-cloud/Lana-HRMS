import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  const isEmployee = roles.includes("EMPLOYEE") || roles.length === 0;

  if (isEmployee) {
    redirect("/employee/dashboard");
  }

  // All other roles (Admin, HR, Manager, etc.)
  redirect("/(hrms)/dashboard");
}
