import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  // If logged in, redirect based on role
  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    const isEmployee = roles.includes("EMPLOYEE") || roles.length === 0;
    
    if (isEmployee) {
      redirect("/employee/dashboard");
    } else {
      redirect("/(hrms)/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-3xl space-y-6">
        <p className="text-sm font-medium uppercase text-muted-foreground">HRMS Foundation</p>
        <h1 className="text-4xl font-semibold">Human Resource Management System</h1>
        <p className="text-lg text-muted-foreground">
          Authentication, authorization, JWT sessions, and RBAC are ready for protected HR workflows.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </section>
    </main>
  );
}
