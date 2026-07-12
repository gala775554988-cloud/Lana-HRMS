import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { resolveRoleDashboard } from "@/config/auth";
import { EmployeeTopBar } from "@/components/employee/EmployeeTopBar";
import { EmployeeDesktopSidebar } from "@/components/employee/EmployeeDesktopSidebar";
import { EmployeeMobileBottomNav } from "@/components/employee/EmployeeMobileBottomNav";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

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
  const session = await auth();

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
  const employee = await getCurrentEmployeeCached();

  // EMPLOYEE with valid session but no linked employee record → show error, NOT redirect to /login
  if (!employee) {
    return <NotLinkedError />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <EmployeeTopBar user={null} employee={employee} />

      <div className="flex">
        <div className="hidden lg:block w-64 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <EmployeeDesktopSidebar />
        </div>

        <div className="flex-1 min-w-0">
          <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <EmployeeMobileBottomNav />
    </div>
  );
}
