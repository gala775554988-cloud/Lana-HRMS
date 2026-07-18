import { prisma } from "@/lib/prisma";

type ScopeItem = {
  id: string;
  module: string;
  scope: string;
  name: string;
};

async function fetchEmployeeScopes(employeeId: string): Promise<ScopeItem[]> {
  if (!employeeId) return [];

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { userId: true }
  });
  if (!employee?.userId) return [];

  const rawScopes = await prisma.hrPermissionScope.findMany({
    where: { userId: employee.userId },
    orderBy: { createdAt: "desc" }
  });
  if (!rawScopes.length) return [];

  const branchIds = Array.from(new Set(rawScopes.map((s) => s.branchId).filter(Boolean) as string[]));
  const deptIds = Array.from(new Set(rawScopes.map((s) => s.departmentId).filter(Boolean) as string[]));
  const hospitalIds = Array.from(new Set(rawScopes.map((s) => (s as any).hospitalId).filter(Boolean) as string[]));

  const [branches, depts, hospitals] = await Promise.all([
    branchIds.length > 0 ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [],
    deptIds.length > 0 ? prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : [],
    hospitalIds.length > 0 ? prisma.hospital.findMany({ where: { id: { in: hospitalIds } }, select: { id: true, name: true } }) : []
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h.name]));

  const scopeNames: Record<string, string> = {
    ALL: "كل الشركة",
    BRANCH: "فرع محدد",
    DEPARTMENT: "قسم محدد",
    HOSPITAL: "مستشفى / موقع",
    TEAM: "فريق مباشر",
    SELF: "ذاتي فقط"
  };

  return rawScopes.map((s) => {
    const scopeLabel = scopeNames[s.scope] || s.scope;
    const targetDetails = s.branchId
      ? ` (${branchMap.get(s.branchId) || s.branchId})`
      : s.departmentId
      ? ` (${deptMap.get(s.departmentId) || s.departmentId})`
      : (s as any).hospitalId
      ? ` (${hospitalMap.get((s as any).hospitalId) || (s as any).hospitalId})`
      : "";

    return {
      id: s.id,
      module: s.module,
      scope: s.scope,
      name: `${s.module}: ${scopeLabel}${targetDetails}`
    };
  });
}

// قم باستبدال الكود الحالي بهذا المنطق
export default async function PermissionsScope({ employeeId }: { employeeId: string }) {
  try {
    // 1. جلب البيانات مع حماية من الأخطاء
    const scopes = await fetchEmployeeScopes(employeeId); // استبدلها بدالة الجلب لديك

    if (!scopes || scopes.length === 0) {
      return (
        <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-md" dir="rtl">
          لا توجد نطاقات صلاحيات محددة لهذا الموظف.
        </div>
      );
    }

    return (
      <div className="scope-container space-y-2" dir="rtl">
        {scopes.map((scope) => (
          <div key={scope.id} className="scope-item flex items-center justify-between p-3 rounded-xl border bg-card text-sm font-medium shadow-sm">
            <span>{scope.name}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/8 text-primary dark:bg-primary/60 dark:text-primary/30">
              {scope.scope}
            </span>
          </div>
        ))}
      </div>
    );
  } catch (error) {
    // 2. إدارة الخطأ محلياً بدلاً من انهيار الصفحة كاملة
    console.error("Error loading scopes:", error);
    return (
      <div className="p-4 border border-red-200 rounded-md text-red-600 text-sm" dir="rtl">
        عذراً، تعذر تحميل النطاقات. يرجى المحاولة لاحقاً.
      </div>
    );
  }
}

export { PermissionsScope };
