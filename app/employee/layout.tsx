import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { EmployeeTopBar } from "@/components/employee/EmployeeTopBar";
import { EmployeeDesktopSidebar } from "@/components/employee/EmployeeDesktopSidebar";
import { EmployeeMobileBottomNav } from "@/components/employee/EmployeeMobileBottomNav";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { isPasswordChangeRequired } from "@/lib/auth/password-change-policy";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const employee = await getCurrentEmployeeCached();

  if (!employee) {
    redirect("/login");
  }

  // Password change check is handled in middleware / page level

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
