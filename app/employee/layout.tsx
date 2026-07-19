import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { resolveRoleDashboard } from "@/config/auth";
import { EmployeeTopBar } from "@/components/employee/EmployeeTopBar";
import { EmployeeDesktopSidebar } from "@/components/employee/EmployeeDesktopSidebar";
import { EmployeeMobileSidebar } from "@/components/employee/EmployeeMobileSidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export const dynamic = "force-dynamic";

const NON_EMPLOYEE_ROLES = [
  "SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER",
  "MANAGER", "HR", "DEPARTMENT_MANAGER", "BRANCH_MANAGER",
  "SUPERVISOR", "PROJECT_MANAGER",
];

function NotLinkedError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
          Employee Profile Not Linked
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your account is authenticated but no employee profile is connected to it.
          Please contact your HR administrator to link your employee record.
        </p>
        <p className="text-xs text-muted-foreground">
          حسابك مصرح به ولكن لا يوجد ملف موظف مرتبط به.
          يرجى التواصل مع إدارة الموارد البشرية لربط سجل الموظف الخاص بك.
        </p>
      </div>
    </div>
  );
}

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await auth().catch(() => null);

  // Only redirect when there is genuinely no session
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles: string[] = (session.user as any).roles ?? [];

  // Non-employee role trying to access employee portal → redirect to their dashboard
  const isEmployee = roles.includes("EMPLOYEE");
  const hasAdminRole = roles.some((r) => NON_EMPLOYEE_ROLES.includes(r));

  if (!isEmployee && hasAdminRole) {
    const target = resolveRoleDashboard(roles);
    redirect(target);
  }

  // EMPLOYEE role: look up employee profile
  const employee = await getCurrentEmployeeCached().catch(() => null);

  // EMPLOYEE with valid session but no linked employee record → show error, NOT redirect to /login
  if (!employee) {
    return <NotLinkedError />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <EmployeeTopBar user={session.user} employee={employee} />

      <div className="flex">
        {/* Hybrid design: solid opaque sidebar with an edge shadow, matching
            the admin AppShell -- glass/blur is reserved for the content area. */}
        <div className="hidden lg:block w-64 border-l border-slate-200/80 bg-white shadow-[0_0_24px_-6px_rgb(15_23_42_/_0.15)] dark:border-slate-800/80 dark:bg-slate-950 dark:shadow-[0_0_24px_-6px_rgb(0_0_0_/_0.4)] sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <EmployeeDesktopSidebar />
        </div>

        <div className="relative flex-1 min-w-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-secondary/[0.08] dark:from-primary/[0.08] dark:to-secondary/[0.1]">
          <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
            <div className="absolute -top-24 end-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[120px] dark:bg-primary/15" />
            <div className="absolute top-1/3 start-0 h-80 w-80 rounded-full bg-secondary/10 blur-[120px] dark:bg-secondary/15" />
          </div>
          <main className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <EmployeeMobileSidebar />
    </div>
  );
}
