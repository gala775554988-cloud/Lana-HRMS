import type { ReactNode } from "react";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee/data";
import { EmployeeTopBar } from "@/components/employee/EmployeeTopBar";
import { EmployeeDesktopSidebar } from "@/components/employee/EmployeeDesktopSidebar";
import { EmployeeMobileBottomNav } from "@/components/employee/EmployeeMobileBottomNav";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { isPasswordChangeRequired } from "@/lib/auth/password-change-policy";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  let employee = null;
  try {
    employee = await getCurrentEmployee();
  } catch (error) {
    console.error("[EmployeeLayout] getCurrentEmployee error:", error);
    employee = null;
  }

  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-lana-pathname") ?? "";
  console.log("[LAYOUT_TRACE]", {
    currentLayout: "app/employee/layout.tsx",
    currentRoute: pathname,
    currentRole: session.user.roles ?? [],
    currentSidebarComponent: "components/employee/EmployeeDesktopSidebar.tsx",
    currentDashboardComponent: pathname.includes("/employee/dashboard") ? "app/employee/dashboard/page.tsx" : null,
    employeeId: employee?.id ?? null,
  });
  if (await isPasswordChangeRequired(session.user.id) && pathname !== "/employee/settings/password") {
    redirect("/employee/settings/password");
  }

  const missingEmployeeNotice = !employee ? (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
      لا توجد بيانات موظف مرتبطة بحسابك حالياً. يرجى التواصل مع الموارد البشرية.
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Premium Top Bar */}
      <EmployeeTopBar user={session.user} employee={employee} />

      <div className="flex">
        {/* Desktop: Right Sidebar (Sticky) */}
        <div className="hidden lg:block w-64 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <EmployeeDesktopSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
            {missingEmployeeNotice}
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <EmployeeMobileBottomNav />
    </div>
  );
}
