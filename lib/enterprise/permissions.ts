import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export type PermissionKey = `${string}:${string}`;
export type PermissionEffectValue = "GRANT" | "DENY";

export type PermissionDefinition = {
  key: PermissionKey;
  action: string;
  resource: string;
  label: string;
  labelAr: string;
  description?: string;
};

export type PermissionCategory = {
  key: string;
  title: string;
  titleAr: string;
  system: "core" | "hr" | "payroll" | "self-service" | "integration" | "admin" | "ai";
  permissions: PermissionDefinition[];
};

const p = (resource: string, action: string, label: string, labelAr: string): PermissionDefinition => ({
  key: `${action}:${resource}` as PermissionKey,
  action,
  resource,
  label,
  labelAr,
});

export const ENTERPRISE_ROLES = [
  "SUPER_ADMIN",
  "HR_DIRECTOR",
  "HR_MANAGER",
  "HR_SPECIALIST",
  "PAYROLL_MANAGER",
  "PAYROLL_OFFICER",
  "ATTENDANCE_MANAGER",
  "RECRUITMENT_MANAGER",
  "DEPARTMENT_MANAGER",
  "BRANCH_MANAGER",
  "EMPLOYEE",
  "AUDITOR",
  "FINANCE",
  "IT_SUPPORT",
  "SYSTEM_ADMIN",
  "READ_ONLY",
] as const;

export type PermissionTemplateKey = typeof ENTERPRISE_ROLES[number] | "PROJECT_MANAGER" | "SUPERVISOR" | "RECRUITER";

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { key: "employees", title: "Employees", titleAr: "الموظفون", system: "hr", permissions: [
    p("employees", "read", "Read", "عرض"), p("employees", "manage", "Manage", "إدارة"), p("employees", "view", "View", "عرض"), p("employees", "create", "Create", "إنشاء"), p("employees", "edit", "Edit", "تعديل"), p("employees", "delete", "Delete", "حذف"), p("employees", "archive", "Archive", "أرشفة"), p("employees", "restore", "Restore", "استعادة"), p("employees", "import", "Import", "استيراد"), p("employees", "export", "Export", "تصدير"), p("employees", "sync-odoo", "Sync Odoo", "مزامنة Odoo"), p("employees", "view-salaries", "View Salaries", "عرض الرواتب"), p("employees", "edit-salaries", "Edit Salaries", "تعديل الرواتب"), p("employees", "view-documents", "View Documents", "عرض المستندات"), p("employees", "upload-documents", "Upload Documents", "رفع المستندات"), p("employees", "delete-documents", "Delete Documents", "حذف المستندات"),
  ] },
  { key: "departments", title: "Departments", titleAr: "الأقسام", system: "hr", permissions: [p("departments", "read", "Read", "عرض"), p("departments", "manage", "Manage", "إدارة"), p("departments", "view", "View", "عرض"), p("departments", "create", "Create", "إنشاء"), p("departments", "edit", "Edit", "تعديل"), p("departments", "delete", "Delete", "حذف")] },
  { key: "branches", title: "Branches", titleAr: "الفروع", system: "hr", permissions: [p("branches", "read", "Read", "عرض"), p("branches", "manage", "Manage", "إدارة"), p("branches", "view", "View", "عرض"), p("branches", "create", "Create", "إنشاء"), p("branches", "edit", "Edit", "تعديل"), p("branches", "delete", "Delete", "حذف")] },
  { key: "hospitals", title: "Hospitals", titleAr: "المستشفيات", system: "hr", permissions: [p("hospitals", "read", "Read", "عرض"), p("hospitals", "manage", "Manage", "إدارة"), p("hospitals", "view", "View", "عرض"), p("hospitals", "create", "Create", "إنشاء"), p("hospitals", "edit", "Edit", "تعديل"), p("hospitals", "delete", "Delete", "حذف")] },
  { key: "positions", title: "Positions", titleAr: "المناصب", system: "hr", permissions: [p("positions", "read", "Read", "عرض"), p("positions", "manage", "Manage", "إدارة"), p("positions", "view", "View", "عرض"), p("positions", "create", "Create", "إنشاء"), p("positions", "edit", "Edit", "تعديل"), p("positions", "delete", "Delete", "حذف")] },
  { key: "contracts", title: "Contracts", titleAr: "العقود", system: "hr", permissions: [p("contracts", "read", "Read", "عرض"), p("contracts", "manage", "Manage", "إدارة"), p("contracts", "view", "View", "عرض"), p("contracts", "create", "Create", "إنشاء"), p("contracts", "edit", "Edit", "تعديل"), p("contracts", "delete", "Delete", "حذف"), p("contracts", "renew", "Renew", "تجديد"), p("contracts", "print", "Print", "طباعة")] },
  { key: "attendance", title: "Attendance", titleAr: "الحضور", system: "hr", permissions: [p("attendance", "read", "Read", "عرض"), p("attendance", "manage", "Manage", "إدارة"), p("attendance", "view", "View", "عرض"), p("attendance", "edit", "Edit", "تعديل"), p("attendance", "manual-attendance", "Manual Attendance", "حضور يدوي"), p("attendance", "import-fingerprint", "Import Fingerprint", "استيراد البصمة"), p("attendance", "export", "Export", "تصدير"), p("attendance", "approve", "Approve", "اعتماد")] },
  { key: "leave", title: "Leave", titleAr: "الإجازات", system: "self-service", permissions: [p("leave", "read", "Read", "عرض"), p("leave", "manage", "Manage", "إدارة"), p("leave", "view", "View", "عرض"), p("leave", "create", "Create", "إنشاء"), p("leave", "edit", "Edit", "تعديل"), p("leave", "delete", "Delete", "حذف"), p("leave", "approve", "Approve", "اعتماد"), p("leave", "reject", "Reject", "رفض")] },
  { key: "payroll", title: "Payroll", titleAr: "الرواتب", system: "payroll", permissions: [p("payroll", "read", "Read", "عرض"), p("payroll", "manage", "Manage", "إدارة"), p("payroll", "view", "View", "عرض"), p("payroll", "create-payroll", "Create Payroll", "إنشاء مسير"), p("payroll", "edit-payroll", "Edit Payroll", "تعديل مسير"), p("payroll", "delete-payroll", "Delete Payroll", "حذف مسير"), p("payroll", "approve-payroll", "Approve Payroll", "اعتماد مسير"), p("payroll", "export-payroll", "Export Payroll", "تصدير الرواتب"), p("payroll", "download-payslip", "Download Payslip", "تحميل القسيمة"), p("loans", "read", "Read Loans", "عرض السلف"), p("loans", "manage", "Manage Loans", "إدارة السلف"), p("allowances", "read", "Read Allowances", "عرض البدلات"), p("allowances", "manage", "Manage Allowances", "إدارة البدلات"), p("deductions", "read", "Read Deductions", "عرض الحسميات"), p("deductions", "manage", "Manage Deductions", "إدارة الحسميات")] },
  { key: "overtime", title: "Overtime", titleAr: "العمل الإضافي", system: "payroll", permissions: [p("overtime", "read", "Read", "عرض"), p("overtime", "manage", "Manage", "إدارة"), p("overtime", "view", "View", "عرض"), p("overtime", "create", "Create", "إنشاء"), p("overtime", "approve", "Approve", "اعتماد"), p("overtime", "reject", "Reject", "رفض")] },
  { key: "performance", title: "Performance", titleAr: "الأداء", system: "hr", permissions: [p("performance", "read", "Read", "عرض"), p("performance", "manage", "Manage", "إدارة"), p("performance", "view", "View", "عرض"), p("performance", "create", "Create", "إنشاء"), p("performance", "edit", "Edit", "تعديل"), p("performance", "approve", "Approve", "اعتماد")] },
  { key: "training", title: "Training", titleAr: "التدريب", system: "hr", permissions: [p("training", "read", "Read", "عرض"), p("training", "manage", "Manage", "إدارة"), p("training", "view", "View", "عرض"), p("training", "create", "Create", "إنشاء"), p("training", "edit", "Edit", "تعديل")] },
  { key: "assets", title: "Assets", titleAr: "الأصول", system: "core", permissions: [p("assets", "read", "Read", "عرض"), p("assets", "manage", "Manage", "إدارة"), p("assets", "view", "View", "عرض"), p("assets", "create", "Create", "إنشاء"), p("assets", "edit", "تعديل", "تعديل"), p("assets", "delete", "Delete", "حذف")] },
  { key: "documents", title: "Documents", titleAr: "المستندات", system: "core", permissions: [p("documents", "read", "Read", "عرض"), p("documents", "manage", "Manage", "إدارة"), p("documents", "view", "View", "عرض"), p("documents", "upload", "Upload", "رفع"), p("documents", "download", "Download", "تحميل"), p("documents", "delete", "Delete", "حذف"), p("documents", "replace", "Replace", "استبدال")] },
  { key: "reports", title: "Reports", titleAr: "التقارير", system: "core", permissions: [p("reports", "read", "Read", "عرض"), p("reports", "manage", "Manage", "إدارة"), p("reports", "view", "View", "عرض"), p("reports", "export-excel", "Export Excel", "تصدير Excel"), p("reports", "export-pdf", "Export PDF", "تصدير PDF")] },
  { key: "odoo", title: "Odoo Integration", titleAr: "تكامل Odoo", system: "integration", permissions: [p("odoo", "read", "Read", "عرض"), p("odoo", "manage", "Manage", "إدارة"), p("odoo", "view", "View", "عرض"), p("odoo", "sync-employees", "Sync Employees", "مزامنة الموظفين"), p("odoo", "sync-departments", "Sync Departments", "مزامنة الأقسام"), p("odoo", "sync-attendance", "Sync Attendance", "مزامنة الحضور"), p("odoo", "sync-payroll", "Sync Payroll", "مزامنة الرواتب"), p("odoo", "view-logs", "View Logs", "عرض السجلات")] },
  { key: "settings", title: "Settings", titleAr: "الإعدادات", system: "admin", permissions: [p("settings", "read", "Read", "عرض"), p("settings", "manage", "Manage", "إدارة"), p("settings", "view", "View", "عرض"), p("settings", "edit", "Edit", "تعديل"), p("permissions", "read", "Read Permissions", "عرض الصلاحيات"), p("permissions", "manage", "Manage Permissions", "إدارة الصلاحيات")] },
  { key: "users", title: "Users", titleAr: "المستخدمون", system: "admin", permissions: [p("users", "read", "Read", "عرض"), p("users", "manage", "Manage", "إدارة"), p("users", "create-user", "Create User", "إنشاء مستخدم"), p("users", "disable-user", "Disable User", "تعطيل مستخدم"), p("users", "reset-password", "Reset Password", "إعادة تعيين كلمة المرور"), p("users", "force-password-change", "Force Password Change", "فرض تغيير كلمة المرور"), p("users", "unlock-user", "Unlock User", "فتح الحساب")] },
  { key: "ai", title: "AI", titleAr: "الذكاء الاصطناعي", system: "ai", permissions: [p("ai", "read", "Read", "عرض"), p("ai", "manage", "Manage", "إدارة"), p("ai", "view", "View", "عرض"), p("ai", "analyze", "Analyze", "تحليل"), p("ai", "generate-reports", "Generate Reports", "إنشاء تقارير")] },
];

export const ALL_ENTERPRISE_PERMISSIONS = Array.from(new Set(PERMISSION_CATEGORIES.flatMap((category) => category.permissions.map((permission) => permission.key)))).sort() as PermissionKey[];

const byResource = (resources: string[], extra: PermissionKey[] = []) => ALL_ENTERPRISE_PERMISSIONS.filter((key) => resources.some((resource) => key.endsWith(`:${resource}`))).concat(extra);
const readOnly = ALL_ENTERPRISE_PERMISSIONS.filter((key) => key.startsWith("read:") || key.startsWith("view:"));

export const PERMISSION_TEMPLATES: Record<PermissionTemplateKey, PermissionKey[]> = {
  SUPER_ADMIN: ALL_ENTERPRISE_PERMISSIONS,
  HR_DIRECTOR: ALL_ENTERPRISE_PERMISSIONS.filter((key) => !key.includes(":settings") && !key.includes(":permissions")),
  HR_MANAGER: byResource(["dashboard", "employees", "departments", "branches", "hospitals", "positions", "contracts", "attendance", "leave", "overtime", "performance", "training", "assets", "documents", "reports", "odoo"]),
  HR_SPECIALIST: byResource(["employees", "departments", "branches", "positions", "contracts", "attendance", "leave", "documents", "reports"]),
  PAYROLL_MANAGER: byResource(["employees", "payroll", "loans", "allowances", "deductions", "overtime", "reports"], ["view-salaries:employees", "edit-salaries:employees"] as PermissionKey[]),
  PAYROLL_OFFICER: byResource(["payroll", "loans", "allowances", "deductions", "reports"], ["view-salaries:employees"] as PermissionKey[]),
  ATTENDANCE_MANAGER: byResource(["employees", "attendance", "overtime", "reports"]),
  RECRUITMENT_MANAGER: byResource(["recruitment", "candidates", "employees", "positions", "documents", "reports"]),
  DEPARTMENT_MANAGER: byResource(["employees", "attendance", "leave", "overtime", "performance", "documents", "reports"]),
  BRANCH_MANAGER: byResource(["employees", "branches", "attendance", "leave", "overtime", "assets", "documents", "reports"]),
  EMPLOYEE: ["read:dashboard", "read:announcements", "read:notifications", "view:documents", "download:documents", "create:leave", "view:leave", "download-payslip:payroll"],
  AUDITOR: readOnly.concat(["view-logs:odoo" as PermissionKey]),
  FINANCE: byResource(["payroll", "loans", "allowances", "deductions", "reports"], ["view-salaries:employees"] as PermissionKey[]),
  IT_SUPPORT: byResource(["users", "settings"], ["read:permissions", "view:settings", "reset-password:users", "unlock-user:users"] as PermissionKey[]),
  SYSTEM_ADMIN: byResource(["users", "settings", "permissions", "odoo", "ai", "reports"]),
  READ_ONLY: readOnly,
  PROJECT_MANAGER: byResource(["employees", "attendance", "leave", "overtime", "performance", "documents", "reports"]),
  SUPERVISOR: byResource(["employees", "attendance", "leave", "overtime", "documents"]),
  RECRUITER: byResource(["recruitment", "candidates", "positions", "documents", "reports"]),
};

export type UserPermissionStore = {
  version: 2;
  users: Record<string, { grants: PermissionKey[]; denies: PermissionKey[]; temporaryGrants?: Record<PermissionKey, string> }>;
};

function normalizePermissionList(values: unknown): PermissionKey[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value): value is PermissionKey => typeof value === "string" && value.includes(":")))).sort();
}

export function permissionDefinitionsByKey() {
  return new Map(PERMISSION_CATEGORIES.flatMap((category) => category.permissions.map((permission) => [permission.key, permission] as const)));
}

export async function ensureEnterpriseRbacSeed() {
  const db = prisma as any;
  const groupIds = new Map<string, string>();
  for (const [sortOrder, category] of PERMISSION_CATEGORIES.entries()) {
    const group = await db.permissionGroup.upsert({
      where: { key: category.key },
      update: { name: category.title, nameAr: category.titleAr, sortOrder, isSystem: true },
      create: { key: category.key, name: category.title, nameAr: category.titleAr, sortOrder, isSystem: true },
      select: { id: true, key: true },
    });
    groupIds.set(group.key, group.id);
  }

  for (const category of PERMISSION_CATEGORIES) {
    const groupId = groupIds.get(category.key);
    for (const [sortOrder, permission] of category.permissions.entries()) {
      await db.permission.upsert({
        where: { action_resource: { action: permission.action, resource: permission.resource } },
        update: { key: permission.key, label: permission.label, description: permission.labelAr, groupId, sortOrder, isSystem: true },
        create: { key: permission.key, action: permission.action, resource: permission.resource, label: permission.label, description: permission.labelAr, groupId, sortOrder, isSystem: true },
      });
    }
  }

  const permissionRows = await db.permission.findMany({ select: { id: true, key: true, action: true, resource: true } });
  const permissionIdByKey = new Map(permissionRows.map((row: any) => [row.key ?? `${row.action}:${row.resource}`, row.id]));
  for (const roleName of ENTERPRISE_ROLES) {
    const role = await db.role.upsert({
      where: { name: roleName },
      update: { isSystem: true, isEditable: roleName !== "SUPER_ADMIN" },
      create: { name: roleName, description: roleName.replaceAll("_", " "), isSystem: true, isEditable: roleName !== "SUPER_ADMIN" },
      select: { id: true },
    });
    const keys = PERMISSION_TEMPLATES[roleName] ?? [];
    const data = keys.map((key) => permissionIdByKey.get(key)).filter(Boolean).map((permissionId) => ({ roleId: role.id, permissionId }));
    if (data.length) await db.rolePermission.createMany({ data, skipDuplicates: true });
  }
}

export async function getPermissionStore(): Promise<UserPermissionStore> {
  const db = prisma as any;
  const rows = await db.userPermission.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { userId: true, effect: true, expiresAt: true, permission: { select: { key: true, action: true, resource: true } } },
    take: 100000,
  }).catch(() => []);
  const users: UserPermissionStore["users"] = {};
  for (const row of rows) {
    const key = (row.permission.key ?? `${row.permission.action}:${row.permission.resource}`) as PermissionKey;
    users[row.userId] ??= { grants: [], denies: [], temporaryGrants: {} };
    if (row.effect === "DENY") users[row.userId].denies.push(key);
    else if (row.expiresAt) users[row.userId].temporaryGrants![key] = row.expiresAt.toISOString();
    else users[row.userId].grants.push(key);
  }
  for (const record of Object.values(users)) {
    record.grants = normalizePermissionList(record.grants);
    record.denies = normalizePermissionList(record.denies);
  }
  return { version: 2, users };
}

export async function getDirectUserPermissions(userId: string): Promise<PermissionKey[]> {
  const store = await getPermissionStore();
  const record = store.users[userId];
  if (!record) return [];
  const permissions = new Set<PermissionKey>([...record.grants, ...Object.keys(record.temporaryGrants ?? {}) as PermissionKey[]]);
  for (const denied of record.denies) permissions.delete(denied);
  return Array.from(permissions).sort();
}

export async function mergeEffectivePermissions(rolePermissions: string[] | undefined, userId?: string): Promise<string[]> {
  const base = new Set(rolePermissions ?? []);
  if (!userId) return Array.from(base).sort();
  const db = prisma as any;
  const overrides = await db.userPermission.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { effect: true, permission: { select: { key: true, action: true, resource: true } } },
  }).catch(() => []);
  for (const override of overrides) {
    const key = override.permission.key ?? `${override.permission.action}:${override.permission.resource}`;
    if (override.effect === "DENY") base.delete(key);
    else base.add(key);
  }
  return Array.from(base).sort();
}

export async function getUserPermissionProfile(userId: string) {
  const db = prisma as any;
  const [user, customRows] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, name: true, email: true, status: true, isActive: true, lastLoginAt: true, loginCount: true, passwordChangedAt: true,
        mustChangePassword: true, isLocked: true, lockReason: true, disabledAt: true,
        roles: { select: { role: { select: { id: true, name: true, permissions: { select: { permission: { select: { key: true, action: true, resource: true } } } } } } } },
        employeeProfile: { select: { id: true, archivedAt: true, status: true } },
      },
    }),
    db.userPermission.findMany({ where: { userId }, select: { effect: true, expiresAt: true, permission: { select: { key: true, action: true, resource: true } } } }),
  ]);
  if (!user) return null;
  const roles = user.roles.map((item: any) => item.role.name);
  const inherited = Array.from(new Set<string>(user.roles.flatMap((item: any) => item.role.permissions.map((rp: any) => rp.permission.key ?? `${rp.permission.action}:${rp.permission.resource}`)))).sort();
  const grants = customRows.filter((row: any) => row.effect === "GRANT" && (!row.expiresAt || row.expiresAt > new Date())).map((row: any) => row.permission.key ?? `${row.permission.action}:${row.permission.resource}`);
  const denies = customRows.filter((row: any) => row.effect === "DENY").map((row: any) => row.permission.key ?? `${row.permission.action}:${row.permission.resource}`);
  const effective = await mergeEffectivePermissions(inherited, userId);
  return { user, roles, inheritedPermissions: inherited, customPermissions: Array.from(new Set(grants)).sort(), deniedPermissions: Array.from(new Set(denies)).sort(), effectivePermissions: effective };
}

export async function setUserPermissions({
  actorUserId,
  targetUserId,
  grants,
  denies,
  temporaryGrants,
  ip,
  userAgent,
  reason = "permissions:update",
}: {
  actorUserId: string;
  targetUserId: string;
  grants: PermissionKey[];
  denies?: PermissionKey[];
  temporaryGrants?: Record<PermissionKey, string>;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string;
}) {
  await ensureEnterpriseRbacSeed().catch(() => undefined);
  const db = prisma as any;
  const previousProfile = await getUserPermissionProfile(targetUserId);
  const permissionRows = await db.permission.findMany({ select: { id: true, key: true, action: true, resource: true } });
  const byKey = new Map(permissionRows.map((row: any) => [row.key ?? `${row.action}:${row.resource}`, row.id]));
  const normalizedGrants = normalizePermissionList(grants);
  const normalizedDenies = normalizePermissionList(denies);
  const temporaryEntries = Object.entries(temporaryGrants ?? {}).filter(([key, value]) => byKey.has(key) && !Number.isNaN(new Date(value).getTime()));

  await db.$transaction([
    db.userPermission.deleteMany({ where: { userId: targetUserId } }),
    ...normalizedGrants.filter((key) => byKey.has(key)).map((key) => db.userPermission.create({ data: { userId: targetUserId, permissionId: byKey.get(key), effect: "GRANT", assignedById: actorUserId, reason } })),
    ...normalizedDenies.filter((key) => byKey.has(key)).map((key) => db.userPermission.create({ data: { userId: targetUserId, permissionId: byKey.get(key), effect: "DENY", assignedById: actorUserId, reason } })),
    ...temporaryEntries.map(([key, expiresAt]) => db.userPermission.create({ data: { userId: targetUserId, permissionId: byKey.get(key), effect: "GRANT", expiresAt: new Date(expiresAt), assignedById: actorUserId, reason } })),
  ]);

  const nextProfile = await getUserPermissionProfile(targetUserId);
  await db.auditPermissionLog.create({
    data: {
      actorUserId,
      targetUserId,
      action: reason,
      oldValue: previousProfile ? { customPermissions: previousProfile.customPermissions, deniedPermissions: previousProfile.deniedPermissions, effectivePermissions: previousProfile.effectivePermissions } : undefined,
      newValue: nextProfile ? { customPermissions: nextProfile.customPermissions, deniedPermissions: nextProfile.deniedPermissions, effectivePermissions: nextProfile.effectivePermissions } : undefined,
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      device: userAgent ?? undefined,
      reason,
    },
  }).catch(() => undefined);
  await writeAuditLog({ actorUserId, action: "permissions:update", entity: "userPermission", entityId: targetUserId, metadata: { previous: previousProfile, next: nextProfile, ip, userAgent, reason } }).catch(() => undefined);
  return { grants: normalizedGrants, denies: normalizedDenies, temporaryGrants: Object.fromEntries(temporaryEntries) };
}
