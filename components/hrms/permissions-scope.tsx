import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";

const MODULE_LABELS: Record<string, string> = {
  employees: "الموظفون", hospitals: "المستشفيات والمواقع", requests: "الطلبات والموافقات",
  attendance: "الحضور والورديات", payroll: "الرواتب", leaves: "الإجازات", insurance: "التأمين",
  "social-insurance": "التأمينات الاجتماعية", loans: "السلف", overtime: "العمل الإضافي",
  documents: "المستندات", contracts: "العقود", assets: "العهد والأصول", reports: "التقارير",
  settings: "الإعدادات", permissions: "الصلاحيات", integrations: "التكاملات",
};

const SCOPE_LABELS: Record<string, string> = {
  ALL: "كل المنشأة", BRANCH: "فرع محدد", DEPARTMENT: "إدارة محددة",
  HOSPITAL: "مستشفى أو موقع", TEAM: "الفريق المباشر", SELF: "ملف الموظف فقط",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدير النظام", HR_MANAGER: "مدير الموارد البشرية", EMPLOYEE: "موظف",
  PAYROLL_MANAGER: "مدير الرواتب", RECRUITER: "مسؤول التوظيف", SUPERVISOR: "مشرف",
};

export default async function PermissionsScope({ employeeId }: { employeeId: string }) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        userId: true,
        user: { select: { roles: { select: { role: { select: { name: true, permissions: { select: { permissionId: true } } } } } } } },
      },
    });
    if (!employee?.userId) return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">لا يوجد حساب مستخدم مرتبط بهذا الموظف.</div>;

    const scopes = await prisma.hrPermissionScope.findMany({ where: { userId: employee.userId }, orderBy: [{ module: "asc" }] });
    const [branches, departments, hospitals] = await Promise.all([
      prisma.branch.findMany({ where: { id: { in: scopes.flatMap((scope) => scope.branchId ? [scope.branchId] : []) } }, select: { id: true, name: true } }),
      prisma.department.findMany({ where: { id: { in: scopes.flatMap((scope) => scope.departmentId ? [scope.departmentId] : []) } }, select: { id: true, name: true } }),
      prisma.hospital.findMany({ where: { id: { in: scopes.flatMap((scope) => scope.hospitalId ? [scope.hospitalId] : []) } }, select: { id: true, name: true } }),
    ]);
    const targetNames = new Map([...branches, ...departments, ...hospitals].map((row) => [row.id, row.name]));
    const roles = employee.user?.roles.map(({ role }) => ({ name: role.name, permissions: role.permissions.length })) ?? [];

    return <div className="space-y-5" dir="rtl">
      <section className="rounded-2xl border bg-card p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-black">الأدوار المعيّنة</h3></div><div className="flex flex-wrap gap-2">{roles.map((role) => <span key={role.name} className="rounded-xl border bg-muted/40 px-3 py-2 text-sm font-bold">{ROLE_LABELS[role.name] ?? role.name}<small className="ms-2 font-normal text-muted-foreground">{role.permissions} صلاحية</small></span>)}</div></section>
      <section className="rounded-2xl border bg-card p-5"><h3 className="mb-4 font-black">نطاقات الوصول</h3>{!scopes.length ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">النطاق الافتراضي: يرى الموظف ملفه فقط.</div> : <div className="grid gap-2 md:grid-cols-2">{scopes.map((scope) => {
        const targetId = scope.branchId || scope.departmentId || scope.hospitalId;
        return <div key={scope.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="font-semibold">{MODULE_LABELS[scope.module] ?? scope.module}</span><span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{SCOPE_LABELS[scope.scope] ?? scope.scope}{targetId ? ` · ${targetNames.get(targetId) ?? targetId}` : ""}</span></div>;
      })}</div>}</section>
    </div>;
  } catch (error) {
    console.error("[PermissionsScope]", error);
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">تعذر تحميل الصلاحيات حالياً.</div>;
  }
}

export { PermissionsScope };
