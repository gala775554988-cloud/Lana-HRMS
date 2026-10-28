import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canManageEmployeeAccounts } from "@/lib/auth/account-management";
import { EmployeeAccountManagement } from "@/components/hrms/employee-account-management";
import { prisma } from "@/lib/prisma";
import PasswordManagementClient from "@/components/hrms/password-management-client";

export const dynamic = "force-dynamic";

export default async function PasswordManagementPage({ searchParams }: { searchParams?: Promise<{ employee?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageEmployeeAccounts(session.user.roles ?? [])) redirect("/");
  // Get counts for display
  const totalEmployees = await prisma.employee.count().catch(() => 0);
  const employeesWithNationalId = await prisma.employee.count({ where: { nationalId: { not: "" } } }).catch(() => 0);
  const employeesWithoutNationalId = totalEmployees - employeesWithNationalId;

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">إدارة حسابات الموظفين وكلمات المرور</h1>
        <p className="text-muted-foreground mt-2">إدارة بيانات الدخول والبريد وإصدار رموز تفعيل الموظفين من مساحة واحدة — لمدير النظام ومدير الموارد البشرية.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">إجمالي الموظفين</div>
            <div className="text-2xl font-bold">{totalEmployees}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">لديهم رقم هوية</div>
            <div className="text-2xl font-bold text-green-600">{employeesWithNationalId}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">بدون رقم هوية</div>
            <div className="text-2xl font-bold text-red-600">{employeesWithoutNationalId}</div>
            <div className="text-xs text-muted-foreground">لن يتم إنشاء حساب لهم</div>
          </div>
        </div>
      </div>
      <EmployeeAccountManagement initialEmployeeId={query?.employee} />
      <PasswordManagementClient totalEmployees={totalEmployees} />
    </div>
  );
}
