import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    const isAdmin = roles.some((role: string) =>
      ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
    );

    redirect(isAdmin ? "/dashboard" : "/employee/dashboard");
  }

  redirect("/login");
}
