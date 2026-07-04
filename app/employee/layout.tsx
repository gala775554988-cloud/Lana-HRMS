import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { EmployeeHeader } from "@/components/employee/EmployeeHeader";
import { EmployeeSidebar } from "@/components/employee/EmployeeSidebar";
import { EmployeeInfoPanel } from "@/components/employee/EmployeeInfoPanel";
import { getCurrentEmployee } from "@/lib/employee/data";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const employee = await getCurrentEmployee();
  if (!employee) {
    return <div className="p-8 text-center">لم يتم العثور على بيانات الموظف.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
      <EmployeeHeader user={session.user} employee={employee} />

      <div className="flex">
        {/* العمود الأيسر: بطاقة معلومات الموظف */}
        <div className="w-72 border-r border-[#E5E7EB] bg-white dark:bg-slate-900 hidden xl:block">
          <EmployeeInfoPanel employee={employee} />
        </div>

        {/* الوسط: Main Dashboard */}
        <div className="flex-1 min-w-0">
          <div className="max-w-[1280px] mx-auto px-6 py-6">
            {children}
          </div>
        </div>

        {/* يمين: Sidebar ثابت 280px */}
        <div className="w-[280px] border-l border-[#E5E7EB] bg-white dark:bg-slate-900 hidden lg:block">
          <EmployeeSidebar currentEmployeeId={employee.id} />
        </div>
      </div>
    </div>
  );
}
