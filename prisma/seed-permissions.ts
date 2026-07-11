import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const groups = [
  { code: "employees", name: "الموظفون", description: "إدارة الموظفين", icon: "Users", sortOrder: 1 },
  { code: "departments", name: "الإدارات", icon: "Building2", sortOrder: 2 },
  { code: "branches", name: "الفروع", icon: "MapPin", sortOrder: 3 },
  { code: "hospitals", name: "المستشفيات", icon: "Building2", sortOrder: 4 },
  { code: "positions", name: "المناصب", icon: "Briefcase", sortOrder: 5 },
  { code: "contracts", name: "العقود", icon: "FileText", sortOrder: 6 },
  { code: "attendance", name: "الحضور", icon: "Clock", sortOrder: 7 },
  { code: "leave", name: "الإجازات", icon: "Calendar", sortOrder: 8 },
  { code: "payroll", name: "الرواتب", icon: "DollarSign", sortOrder: 9 },
  { code: "overtime", name: "الأوفر تايم", icon: "Clock", sortOrder: 10 },
  { code: "performance", name: "الأداء", icon: "GraduationCap", sortOrder: 11 },
  { code: "training", name: "التدريب", icon: "GraduationCap", sortOrder: 12 },
  { code: "assets", name: "الأصول", icon: "Package", sortOrder: 13 },
  { code: "documents", name: "المستندات", icon: "FileText", sortOrder: 14 },
  { code: "reports", name: "التقارير", icon: "BarChart3", sortOrder: 15 },
  { code: "odoo_integration", name: "تكامل Odoo", icon: "PlugZap", sortOrder: 16 },
  { code: "settings", name: "الإعدادات", icon: "Settings", sortOrder: 17 },
  { code: "users", name: "المستخدمون", icon: "Shield", sortOrder: 18 },
  { code: "ai", name: "الذكاء الاصطناعي", icon: "Sparkles", sortOrder: 19 },
];

const permissionsByGroup: Record<string, Array<{ action: string; resource: string; description: string }>> = {
  employees: [
    { action: "View", resource: "employees", description: "عرض الموظفين" },
    { action: "Create", resource: "employees", description: "إنشاء موظف" },
    { action: "Edit", resource: "employees", description: "تعديل موظف" },
    { action: "Delete", resource: "employees", description: "حذف موظف" },
    { action: "Archive", resource: "employees", description: "أرشفة موظف" },
    { action: "Restore", resource: "employees", description: "استعادة موظف مؤرشف" },
    { action: "Import", resource: "employees", description: "استيراد موظفين" },
    { action: "Export", resource: "employees", description: "تصدير موظفين" },
    { action: "Sync Odoo", resource: "employees", description: "مزامنة الموظفين من Odoo" },
    { action: "View Salaries", resource: "employees", description: "عرض رواتب الموظفين" },
    { action: "Edit Salaries", resource: "employees", description: "تعديل رواتب الموظفين" },
    { action: "View Documents", resource: "employees", description: "عرض مستندات الموظفين" },
    { action: "Upload Documents", resource: "employees", description: "رفع مستندات الموظفين" },
    { action: "Delete Documents", resource: "employees", description: "حذف مستندات الموظفين" },
  ],
  departments: [
    { action: "View", resource: "departments", description: "عرض الإدارات" },
    { action: "Create", resource: "departments", description: "إنشاء إدارة" },
    { action: "Edit", resource: "departments", description: "تعديل إدارة" },
    { action: "Delete", resource: "departments", description: "حذف إدارة" },
  ],
  branches: [
    { action: "View", resource: "branches", description: "عرض الفروع" },
    { action: "Create", resource: "branches", description: "إنشاء فرع" },
    { action: "Edit", resource: "branches", description: "تعديل فرع" },
    { action: "Delete", resource: "branches", description: "حذف فرع" },
  ],
  hospitals: [
    { action: "View", resource: "hospitals", description: "عرض المستشفيات" },
    { action: "Create", resource: "hospitals", description: "إنشاء مستشفى" },
    { action: "Edit", resource: "hospitals", description: "تعديل مستشفى" },
    { action: "Delete", resource: "hospitals", description: "حذف مستشفى" },
  ],
  positions: [
    { action: "View", resource: "positions", description: "عرض المناصب" },
    { action: "Create", resource: "positions", description: "إنشاء منصب" },
    { action: "Edit", resource: "positions", description: "تعديل منصب" },
    { action: "Delete", resource: "positions", description: "حذف منصب" },
  ],
  contracts: [
    { action: "View", resource: "contracts", description: "عرض العقود" },
    { action: "Create", resource: "contracts", description: "إنشاء عقد" },
    { action: "Edit", resource: "contracts", description: "تعديل عقد" },
    { action: "Delete", resource: "contracts", description: "حذف عقد" },
    { action: "Renew", resource: "contracts", description: "تجديد عقد" },
    { action: "Print", resource: "contracts", description: "طباعة عقد" },
  ],
  attendance: [
    { action: "View", resource: "attendance", description: "عرض الحضور" },
    { action: "Edit", resource: "attendance", description: "تعديل حضور" },
    { action: "Manual Attendance", resource: "attendance", description: "حضور يدوي" },
    { action: "Import Fingerprint", resource: "attendance", description: "استيراد بصمة" },
    { action: "Export", resource: "attendance", description: "تصدير حضور" },
    { action: "Approve", resource: "attendance", description: "اعتماد حضور" },
  ],
  leave: [
    { action: "View", resource: "leave", description: "عرض الإجازات" },
    { action: "Create", resource: "leave", description: "إنشاء إجازة" },
    { action: "Edit", resource: "leave", description: "تعديل إجازة" },
    { action: "Delete", resource: "leave", description: "حذف إجازة" },
    { action: "Approve", resource: "leave", description: "اعتماد إجازة" },
    { action: "Reject", resource: "leave", description: "رفض إجازة" },
  ],
  payroll: [
    { action: "View", resource: "payroll", description: "عرض الرواتب" },
    { action: "Create Payroll", resource: "payroll", description: "إنشاء مسير رواتب" },
    { action: "Edit Payroll", resource: "payroll", description: "تعديل مسير رواتب" },
    { action: "Delete Payroll", resource: "payroll", description: "حذف مسير رواتب" },
    { action: "Approve Payroll", resource: "payroll", description: "اعتماد الرواتب" },
    { action: "Export Payroll", resource: "payroll", description: "تصدير الرواتب" },
    { action: "Download Payslip", resource: "payroll", description: "تحميل قسيمة راتب" },
  ],
  overtime: [
    { action: "View", resource: "overtime", description: "عرض الأوفر تايم" },
    { action: "Create", resource: "overtime", description: "إنشاء أوفر تايم" },
    { action: "Approve", resource: "overtime", description: "اعتماد أوفر تايم" },
    { action: "Reject", resource: "overtime", description: "رفض أوفر تايم" },
  ],
  performance: [
    { action: "View", resource: "performance", description: "عرض الأداء" },
    { action: "Create", resource: "performance", description: "إنشاء تقييم" },
    { action: "Edit", resource: "performance", description: "تعديل تقييم" },
    { action: "Approve", resource: "performance", description: "اعتماد تقييم" },
  ],
  training: [
    { action: "View", resource: "training", description: "عرض التدريب" },
    { action: "Create", resource: "training", description: "إنشاء تدريب" },
    { action: "Edit", resource: "training", description: "تعديل تدريب" },
  ],
  assets: [
    { action: "View", resource: "assets", description: "عرض الأصول" },
    { action: "Create", resource: "assets", description: "إنشاء أصل" },
    { action: "Edit", resource: "assets", description: "تعديل أصل" },
    { action: "Delete", resource: "assets", description: "حذف أصل" },
  ],
  documents: [
    { action: "View", resource: "documents", description: "عرض المستندات" },
    { action: "Upload", resource: "documents", description: "رفع مستند" },
    { action: "Download", resource: "documents", description: "تحميل مستند" },
    { action: "Delete", resource: "documents", description: "حذف مستند" },
    { action: "Replace", resource: "documents", description: "استبدال مستند" },
  ],
  reports: [
    { action: "View", resource: "reports", description: "عرض التقارير" },
    { action: "Export Excel", resource: "reports", description: "تصدير Excel" },
    { action: "Export PDF", resource: "reports", description: "تصدير PDF" },
  ],
  odoo_integration: [
    { action: "View", resource: "odoo_integration", description: "عرض تكامل Odoo" },
    { action: "Sync Employees", resource: "odoo_integration", description: "مزامنة الموظفين" },
    { action: "Sync Departments", resource: "odoo_integration", description: "مزامنة الإدارات" },
    { action: "Sync Attendance", resource: "odoo_integration", description: "مزامنة الحضور" },
    { action: "Sync Payroll", resource: "odoo_integration", description: "مزامنة الرواتب" },
    { action: "View Logs", resource: "odoo_integration", description: "عرض سجلات المزامنة" },
  ],
  settings: [
    { action: "View", resource: "settings", description: "عرض الإعدادات" },
    { action: "Edit", resource: "settings", description: "تعديل الإعدادات" },
  ],
  users: [
    { action: "Create User", resource: "users", description: "إنشاء مستخدم" },
    { action: "Disable User", resource: "users", description: "تعطيل مستخدم" },
    { action: "Reset Password", resource: "users", description: "إعادة تعيين كلمة المرور" },
    { action: "Force Password Change", resource: "users", description: "إجبار تغيير كلمة المرور" },
    { action: "Unlock User", resource: "users", description: "إلغاء قفل المستخدم" },
  ],
  ai: [
    { action: "View", resource: "ai", description: "عرض الذكاء الاصطناعي" },
    { action: "Analyze", resource: "ai", description: "تحليل بالذكاء الاصطناعي" },
    { action: "Generate Reports", resource: "ai", description: "إنشاء تقارير ذكية" },
  ],
};

const roles = [
  { name: "SUPER_ADMIN", description: "مدير النظام العام - جميع الصلاحيات", isSystem: true },
  { name: "HR_DIRECTOR", description: "مدير الموارد البشرية", isSystem: true },
  { name: "HR_MANAGER", description: "مدير عمليات الموارد البشرية", isSystem: true },
  { name: "HR_SPECIALIST", description: "أخصائي موارد بشرية", isSystem: true },
  { name: "PAYROLL_MANAGER", description: "مدير الرواتب", isSystem: true },
  { name: "PAYROLL_OFFICER", description: "موظف رواتب", isSystem: true },
  { name: "ATTENDANCE_MANAGER", description: "مدير الحضور", isSystem: true },
  { name: "RECRUITMENT_MANAGER", description: "مدير التوظيف", isSystem: true },
  { name: "DEPARTMENT_MANAGER", description: "مدير إدارة", isSystem: true },
  { name: "BRANCH_MANAGER", description: "مدير فرع", isSystem: true },
  { name: "EMPLOYEE", description: "موظف عادي", isSystem: true },
  { name: "AUDITOR", description: "مدقق", isSystem: true },
  { name: "FINANCE", description: "المالية", isSystem: true },
  { name: "IT_SUPPORT", description: "الدعم الفني", isSystem: true },
  { name: "SYSTEM_ADMIN", description: "مدير النظام", isSystem: true },
  { name: "READ_ONLY", description: "قراءة فقط", isSystem: true },
];

async function main() {
  console.log("Seeding Permission Groups...");
  for (const group of groups) {
    await prisma.permissionGroup.upsert({
      where: { code: group.code },
      update: { name: group.name, description: group.description, icon: group.icon, sortOrder: group.sortOrder },
      create: { code: group.code, name: group.name, description: group.description, icon: group.icon, sortOrder: group.sortOrder },
    });
  }

  console.log("Seeding Permissions...");
  let sortOrder = 0;
  for (const [groupCode, perms] of Object.entries(permissionsByGroup)) {
    for (const perm of perms) {
      sortOrder++;
      await prisma.permission.upsert({
        where: { action_resource: { action: perm.action, resource: perm.resource } },
        update: { description: perm.description, groupCode, sortOrder, isSystem: false },
        create: { action: perm.action, resource: perm.resource, description: perm.description, groupCode, sortOrder, isSystem: false },
      });
    }
  }

  console.log("Seeding Roles...");
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: role.isSystem },
      create: { name: role.name, description: role.description, isSystem: role.isSystem },
    });
  }

  console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
