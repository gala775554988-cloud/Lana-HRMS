import { prisma } from "@/lib/prisma";
import PasswordManagementClient from "@/components/hrms/password-management-client";

export const dynamic = "force-dynamic";

export default async function PasswordManagementPage() {
  // Get counts for display
  const totalEmployees = await prisma.employee.count().catch(() => 0);
  const employeesWithNationalId = await prisma.employee.count({ where: { nationalId: { not: "" } } }).catch(() => 0);
  const employeesWithoutNationalId = totalEmployees - employeesWithNationalId;

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">إدارة كلمات المرور</h1>
        <p className="text-muted-foreground mt-2">إعادة تعيين كلمات المرور للموظفين إلى آخر 4 أرقام من رقم الهوية - مسموح فقط لـ HR و Super Admin</p>
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
      <PasswordManagementClient totalEmployees={totalEmployees} />
    </div>
  );
}
