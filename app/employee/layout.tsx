import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee/data";
import { EmployeeTopBar } from "@/components/employee/EmployeeTopBar";
import { EmployeeDesktopSidebar } from "@/components/employee/EmployeeDesktopSidebar";
import { EmployeeMobileBottomNav } from "@/components/employee/EmployeeMobileBottomNav";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

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

  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">👤</div>
          <p className="text-lg text-slate-600 mb-2">لم يتم العثور على بيانات الموظف</p>
          <p className="text-sm text-slate-400 mb-6">يرجى التواصل مع الموارد البشرية لربط حسابك</p>
          <a href="/login" className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
            تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
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
