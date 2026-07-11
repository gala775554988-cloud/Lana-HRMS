import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export type PermissionKey = `${string}:${string}`;
export type PermissionEffect = "grant" | "deny";

export type PermissionCategory = {
  key: string;
  title: string;
  permissions: PermissionKey[];
};

export type PermissionTemplateKey =
  | "SUPER_ADMIN"
  | "HR_MANAGER"
  | "BRANCH_MANAGER"
  | "DEPARTMENT_MANAGER"
  | "PROJECT_MANAGER"
  | "SUPERVISOR"
  | "PAYROLL_OFFICER"
  | "INSURANCE_OFFICER"
  | "RESIDENCY_OFFICER"
  | "REQUESTS_OFFICER"
  | "WAREHOUSE_OFFICER"
  | "EMPLOYEE";

export type UserPermissionStore = {
  version: 1;
  users: Record<string, {
    grants: PermissionKey[];
    denies: PermissionKey[];
    temporaryGrants?: Record<PermissionKey, string>;
  }>;
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { key: "employees", title: "Employees", permissions: ["read:employees", "manage:employees"] },
  { key: "attendance", title: "Attendance", permissions: ["read:attendance", "manage:attendance"] },
  { key: "leaves", title: "Leaves", permissions: ["read:leave", "manage:leave"] },
  { key: "payroll", title: "Payroll", permissions: ["read:payroll", "manage:payroll", "read:loans", "manage:loans", "read:allowances", "manage:allowances", "read:deductions", "manage:deductions"] },
  { key: "insurance", title: "Insurance", permissions: ["read:insurance", "manage:insurance"] },
  { key: "residency", title: "Residency", permissions: ["read:residency", "manage:residency"] },
  { key: "requests", title: "Requests", permissions: ["read:requests", "manage:requests", "read:overtime", "manage:overtime"] },
  { key: "projects", title: "Projects", permissions: ["read:projects", "manage:projects"] },
  { key: "warehouse", title: "Warehouse", permissions: ["read:warehouse", "manage:warehouse"] },
  { key: "assets", title: "Assets", permissions: ["read:assets", "manage:assets"] },
  { key: "reports", title: "Reports", permissions: ["read:reports", "manage:reports"] },
  { key: "documents", title: "Documents", permissions: ["read:documents", "manage:documents", "read:contracts", "manage:contracts"] },
  { key: "administration", title: "Administration", permissions: ["read:dashboard", "read:audit-logs", "manage:audit-logs", "read:announcements", "manage:announcements", "read:notifications", "manage:notifications"] },
  { key: "settings", title: "Settings", permissions: ["read:settings", "manage:settings", "read:permissions", "manage:permissions"] }
];

export const ALL_ENTERPRISE_PERMISSIONS = Array.from(new Set(PERMISSION_CATEGORIES.flatMap((category) => category.permissions))).sort() as PermissionKey[];

export const PERMISSION_TEMPLATES: Record<PermissionTemplateKey, PermissionKey[]> = {
  SUPER_ADMIN: ALL_ENTERPRISE_PERMISSIONS,
  HR_MANAGER: ALL_ENTERPRISE_PERMISSIONS.filter((permission) => !permission.includes("settings") && !permission.includes("permissions")),
  BRANCH_MANAGER: ["read:dashboard", "read:employees", "read:attendance", "read:leave", "manage:leave", "read:requests", "manage:requests", "read:performance", "manage:performance", "read:documents", "read:reports"],
  DEPARTMENT_MANAGER: ["read:dashboard", "read:employees", "read:attendance", "read:leave", "manage:leave", "read:requests", "manage:requests", "read:performance", "manage:performance", "read:documents", "read:reports"],
  PROJECT_MANAGER: ["read:dashboard", "read:employees", "read:projects", "manage:projects", "read:attendance", "read:leave", "read:requests", "read:performance", "read:documents", "read:reports"],
  SUPERVISOR: ["read:dashboard", "read:employees", "read:attendance", "read:leave", "manage:leave", "read:requests", "manage:requests", "read:performance", "read:documents"],
  PAYROLL_OFFICER: ["read:dashboard", "read:employees", "read:payroll", "manage:payroll", "read:loans", "manage:loans", "read:allowances", "manage:allowances", "read:deductions", "manage:deductions", "read:reports"],
  INSURANCE_OFFICER: ["read:dashboard", "read:employees", "read:insurance", "manage:insurance", "read:documents", "read:reports"],
  RESIDENCY_OFFICER: ["read:dashboard", "read:employees", "read:residency", "manage:residency", "read:documents", "manage:documents", "read:reports"],
  REQUESTS_OFFICER: ["read:dashboard", "read:employees", "read:requests", "manage:requests", "read:leave", "manage:leave", "read:overtime", "manage:overtime"],
  WAREHOUSE_OFFICER: ["read:dashboard", "read:employees", "read:warehouse", "manage:warehouse", "read:assets", "manage:assets"],
  EMPLOYEE: ["read:dashboard", "read:announcements", "read:notifications"]
};

const STORE_KEY = "enterprise.userPermissions";

function normalizePermissionList(values: unknown): PermissionKey[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value): value is PermissionKey => typeof value === "string" && value.includes(":")))).sort();
}

function normalizeStore(value: unknown): UserPermissionStore {
  if (!value || typeof value !== "object") return { version: 1, users: {} };
  const raw = value as { users?: Record<string, unknown> };
  const users: UserPermissionStore["users"] = {};
  for (const [userId, record] of Object.entries(raw.users ?? {})) {
    const item = record as { grants?: unknown; denies?: unknown; temporaryGrants?: Record<string, unknown> };
    const temporaryGrants = Object.fromEntries(
      Object.entries(item.temporaryGrants ?? {}).filter(([permission, expiresAt]) => typeof permission === "string" && typeof expiresAt === "string")
    ) as Record<PermissionKey, string>;
    users[userId] = {
      grants: normalizePermissionList(item.grants),
      denies: normalizePermissionList(item.denies),
      temporaryGrants
    };
  }
  return { version: 1, users };
}

export async function getPermissionStore(): Promise<UserPermissionStore> {
  const setting = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null);
  return normalizeStore(setting?.value);
}

export async function savePermissionStore(store: UserPermissionStore) {
  return prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    update: { value: store },
    create: { key: STORE_KEY, value: store, description: "Direct per-user enterprise permissions and overrides" }
  });
}

export async function getDirectUserPermissions(userId: string, now = new Date()): Promise<PermissionKey[]> {
  const store = await getPermissionStore();
  const record = store.users[userId];
  if (!record) return [];
  const activeTemporary = Object.entries(record.temporaryGrants ?? {})
    .filter(([, expiresAt]) => new Date(expiresAt).getTime() > now.getTime())
    .map(([permission]) => permission as PermissionKey);
  const permissions = new Set<PermissionKey>([...record.grants, ...activeTemporary]);
  for (const denied of record.denies) permissions.delete(denied);
  return Array.from(permissions).sort();
}

export async function mergeEffectivePermissions(rolePermissions: string[] | undefined, userId?: string): Promise<string[]> {
  const base = new Set(rolePermissions ?? []);
  if (!userId) return Array.from(base).sort();
  const store = await getPermissionStore();
  const record = store.users[userId];
  if (!record) return Array.from(base).sort();
  const now = Date.now();
  for (const grant of record.grants) base.add(grant);
  for (const [permission, expiresAt] of Object.entries(record.temporaryGrants ?? {})) {
    if (new Date(expiresAt).getTime() > now) base.add(permission);
  }
  for (const denied of record.denies) base.delete(denied);
  return Array.from(base).sort();
}

export async function setUserPermissions({
  actorUserId,
  targetUserId,
  grants,
  denies,
  temporaryGrants,
  ip,
  reason = "permissions:update"
}: {
  actorUserId: string;
  targetUserId: string;
  grants: PermissionKey[];
  denies?: PermissionKey[];
  temporaryGrants?: Record<PermissionKey, string>;
  ip?: string | null;
  reason?: string;
}) {
  const store = await getPermissionStore();
  const previous = store.users[targetUserId] ?? { grants: [], denies: [], temporaryGrants: {} };
  const next = {
    grants: normalizePermissionList(grants),
    denies: normalizePermissionList(denies),
    temporaryGrants: temporaryGrants ?? previous.temporaryGrants ?? {}
  };
  store.users[targetUserId] = next;
  await savePermissionStore(store);
  await writeAuditLog({
    actorUserId,
    action: "permissions:update",
    entity: "userPermission",
    entityId: targetUserId,
    metadata: { previous, next, ip, reason }
  });
  return next;
}
