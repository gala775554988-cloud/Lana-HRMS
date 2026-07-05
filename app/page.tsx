import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    
    // If user has any admin-level role, send to HRMS dashboard
    const isAdmin = roles.some(role => 
      ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
    );

    if (isAdmin) {
      redirect("/(hrms)/dashboard");
    } else {
      redirect("/employee/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-3xl space-y-6 text-center">
        <p className="text-sm font-medium uppercase text-muted-foreground">HRMS Foundation</p>
        <h1 className="text-4xl font-semibold">Human Resource Management System</h1>
        <p className="text-lg text-muted-foreground">
          Authentication, authorization, JWT sessions, and RBAC are ready for protected HR workflows.
        </p>
        
        <div className="pt-4">
          <Button asChild size="lg">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </div>

        {/* Small link for Admin */}
        <div className="pt-6">
          <Link 
            href="/login" 
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            تسجيل الدخول كمسؤول (لوحة التحكم)
          </Link>
        </div>
      </section>
    </main>
  );
}
