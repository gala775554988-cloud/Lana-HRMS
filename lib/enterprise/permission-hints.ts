// Client-safe (no server-only imports) permission hint catalog: describes,
// in plain Arabic, what each `action:resource` permission key actually
// unlocks. Kept separate from lib/enterprise/permissions.ts because that
// file pulls in Prisma/audit/cache modules that must never end up in a
// client bundle.

type ResourceHint = { subject: string; view: string; manage: string };

const RESOURCE_HINTS: Record<string, ResourceHint> = {
  employees: { subject: "سجلات الموظفين", view: "استعراض بيانات الموظفين الأساسية (الاسم، القسم، الحالة)", manage: "إنشاء وتعديل وحذف سجلات الموظفين" },
  attendance: { subject: "الحضور والانصراف", view: "استعراض سجلات الحضور والانصراف", manage: "تعديل سجلات الحضور وتسجيل الاستثناءات" },
  leave: { subject: "الإجازات", view: "استعراض طلبات الإجازات وأرصدتها", manage: "الموافقة على طلبات الإجازات أو رفضها وتعديل الأرصدة" },
  payroll: { subject: "الرواتب", view: "استعراض تفاصيل الرواتب وكشوفها", manage: "تعديل الرواتب واعتماد كشوف الصرف" },
  loans: { subject: "السلف", view: "استعراض طلبات السلف", manage: "الموافقة على السلف وتعديل شروط السداد" },
  allowances: { subject: "البدلات", view: "استعراض البدلات المستحقة", manage: "إضافة أو تعديل البدلات" },
  deductions: { subject: "الاستقطاعات", view: "استعراض الاستقطاعات", manage: "إضافة أو تعديل الاستقطاعات" },
  insurance: { subject: "التأمين", view: "استعراض بيانات التأمين الطبي", manage: "تعديل بيانات التأمين وتجديد البوالص" },
  residency: { subject: "الإقامات", view: "استعراض بيانات الإقامة وتواريخ الانتهاء", manage: "تجديد الإقامات وتعديل بياناتها" },
  requests: { subject: "الطلبات العامة", view: "استعراض طلبات الموظفين", manage: "الموافقة على الطلبات أو رفضها أو تحويلها" },
  overtime: { subject: "الأوفر تايم", view: "استعراض طلبات الأوفر تايم", manage: "الموافقة على الأوفر تايم واحتسابه في كشف الرواتب" },
  projects: { subject: "المشاريع", view: "استعراض المشاريع والموظفين المسندين لها", manage: "إنشاء المشاريع وتعديل فرق العمل" },
  warehouse: { subject: "المستودع", view: "استعراض المخزون والأصناف", manage: "إضافة وتعديل حركات المخزون" },
  assets: { subject: "العهد", view: "استعراض العهد المسندة للموظفين", manage: "إسناد العهد واستردادها" },
  reports: { subject: "التقارير", view: "استعراض التقارير التحليلية", manage: "إنشاء تقارير جديدة وتخصيصها" },
  documents: { subject: "المستندات", view: "استعراض مستندات الموظفين", manage: "رفع وحذف مستندات الموظفين" },
  contracts: { subject: "العقود", view: "استعراض عقود العمل", manage: "إنشاء عقود جديدة وتعديل شروطها" },
  dashboard: { subject: "لوحة التحكم", view: "الوصول إلى لوحة التحكم الرئيسية", manage: "الوصول إلى لوحة التحكم الرئيسية" },
  "audit-logs": { subject: "سجل التدقيق", view: "استعراض سجل العمليات والتغييرات", manage: "حذف أو تعديل سجلات التدقيق" },
  announcements: { subject: "الإعلانات", view: "استعراض الإعلانات الداخلية", manage: "نشر وتعديل وحذف الإعلانات" },
  notifications: { subject: "الإشعارات", view: "استعراض الإشعارات", manage: "إرسال إشعارات جماعية للموظفين" },
  settings: { subject: "إعدادات النظام", view: "استعراض إعدادات النظام العامة", manage: "تعديل إعدادات النظام العامة" },
  permissions: { subject: "الصلاحيات", view: "استعراض أدوار وصلاحيات المستخدمين", manage: "تعديل أدوار وصلاحيات المستخدمين وتخصيص وصولهم" }
};

export function getPermissionHint(permission: string): { title: string; effect: string } {
  const [action, resource] = permission.split(":");
  const info = RESOURCE_HINTS[resource];
  if (!info) return { title: permission, effect: "صلاحية نظامية دقيقة بدون وصف تفصيلي متاح حالياً." };
  const effect = action === "manage" ? info.manage : info.view;
  return {
    title: `${action === "manage" ? "إدارة" : "عرض"} ${info.subject}`,
    effect: effect || `الوصول إلى ${info.subject}`
  };
}
