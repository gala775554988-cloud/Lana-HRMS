import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { memoryCache, clearMemoryCache } from "@/lib/cache/memory-cache";
import { withQueryTiming } from "@/lib/perf/query-timer";

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
  | "SOCIAL_INSURANCE_OFFICER"
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

// Resources with real, separately-enforced create/edit/delete permissions --
// see GRANULAR_MUTATION_RESOURCES in lib/hrms/actions.ts, which is the actual
// enforcement point. A plain "manage:X" grant from before this existed still
// implies all four (hasPermission in lib/rbac.ts), so nothing already
// configured breaks; these are additive, finer-grained keys.
export const GRANULAR_RESOURCES = ["employees", "contracts", "attendance", "insurance", "hospitals", "social-insurance"] as const;

function granularPermissions(resource: string): PermissionKey[] {
  return [`read:${resource}`, `create:${resource}`, `edit:${resource}`, `delete:${resource}`] as PermissionKey[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { key: "employees", title: "Employees", permissions: [...granularPermissions("employees"), "manage:employees"] },
  // Full Cascade Access: granting any hospitals permission automatically
  // cascades matching read/manage access to branches and departments too
  // (see CASCADE_CHILDREN / withCascadedGrants below), since those are
  // structurally sub-elements of a hospital in this org model.
  { key: "hospitals", title: "Hospitals", permissions: [...granularPermissions("hospitals"), "manage:hospitals"] },
  { key: "attendance", title: "Attendance", permissions: [...granularPermissions("attendance"), "manage:attendance"] },
  { key: "leaves", title: "Leaves", permissions: ["read:leave", "manage:leave"] },
  { key: "payroll", title: "Payroll", permissions: ["read:payroll", "manage:payroll", "read:loans", "manage:loans", "read:allowances", "manage:allowances", "read:deductions", "manage:deductions"] },
  { key: "insurance", title: "Insurance", permissions: [...granularPermissions("insurance"), "manage:insurance"] },
  { key: "social-insurance", title: "Social Insurance", permissions: [...granularPermissions("social-insurance"), "manage:social-insurance"] },
  { key: "residency", title: "Residency", permissions: ["read:residency", "manage:residency"] },
  { key: "requests", title: "Requests", permissions: ["read:requests", "manage:requests", "read:overtime", "manage:overtime"] },
  { key: "projects", title: "Projects", permissions: ["read:projects", "manage:projects"] },
  { key: "warehouse", title: "Warehouse", permissions: ["read:warehouse", "manage:warehouse"] },
  { key: "assets", title: "Assets", permissions: ["read:assets", "manage:assets"] },
  { key: "reports", title: "Reports", permissions: ["read:reports", "manage:reports"] },
  { key: "documents", title: "Documents", permissions: ["read:documents", "manage:documents", ...granularPermissions("contracts"), "manage:contracts"] },
  { key: "administration", title: "Administration", permissions: ["read:dashboard", "read:audit-logs", "manage:audit-logs", "read:announcements", "manage:announcements", "read:notifications", "manage:notifications"] },
  { key: "settings", title: "Settings", permissions: ["read:settings", "manage:settings", "read:permissions", "manage:permissions"] }
];

export const ALL_ENTERPRISE_PERMISSIONS = Array.from(new Set(PERMISSION_CATEGORIES.flatMap((category) => category.permissions))).sort() as PermissionKey[];

export type PermissionTreeAction = { key: PermissionKey; action: string; label: string };
export type PermissionTreeFeature = { resource: string; label: string; granular: boolean; actions: PermissionTreeAction[] };
export type PermissionTreeCategory = { key: string; title: string; features: PermissionTreeFeature[]; allPermissions: PermissionKey[] };

const ACTION_LABELS_EN: Record<string, string> = {
  read: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  manage: "Manage"
};

/**
 * Groups each category's flat permission list into per-resource "features"
 * for the hierarchical permission tree UI (module -> feature -> actions).
 * Resources in GRANULAR_RESOURCES show real View/Create/Edit/Delete
 * checkboxes; every other resource still only has View/Manage, honestly,
 * since that's genuinely all that's enforced for it today.
 */
export function buildPermissionTree(categories: PermissionCategory[]): PermissionTreeCategory[] {
  return categories.map((category) => {
    const byResource = new Map<string, PermissionKey[]>();
    for (const key of category.permissions) {
      const [, resource] = key.split(":");
      if (!resource) continue;
      const list = byResource.get(resource) ?? [];
      list.push(key);
      byResource.set(resource, list);
    }
    const features: PermissionTreeFeature[] = Array.from(byResource.entries()).map(([resource, keys]) => ({
      resource,
      label: resource,
      granular: (GRANULAR_RESOURCES as readonly string[]).includes(resource),
      actions: keys.map((key) => {
        const action = key.split(":")[0];
        return { key, action, label: ACTION_LABELS_EN[action] ?? action };
      })
    }));
    return { key: category.key, title: category.title, features, allPermissions: category.permissions };
  });
}

export const PERMISSION_TEMPLATES: Record<PermissionTemplateKey, PermissionKey[]> = {
  SUPER_ADMIN: ALL_ENTERPRISE_PERMISSIONS,
  HR_MANAGER: ALL_ENTERPRISE_PERMISSIONS.filter((permission) => !permission.includes("settings") && !permission.includes("permissions")),
  BRANCH_MANAGER: ["read:dashboard", "read:employees", "read:attendance", "read:leave", "manage:leave", "read:requests", "manage:requests", "read:performance", "manage:performance", "read:documents", "read:reports"],
  DEPARTMENT_MANAGER: ["read:dashboard", "read:employees", "read:attendance", "read:leave", "manage:leave", "read:requests", "manage:requests", "read:performance", "manage:performance", "read:documents", "read:reports"],
  PROJECT_MANAGER: ["read:dashboard", "read:employees", "read:projects", "manage:projects", "read:attendance", "read:leave", "read:requests", "read:performance", "read:documents", "read:reports"],
  SUPERVISOR: ["read:dashboard", "read:employees", "read:attendance", "read:leave", "manage:leave", "read:requests", "manage:requests", "read:performance", "read:documents"],
  PAYROLL_OFFICER: ["read:dashboard", "read:employees", "read:payroll", "manage:payroll", "read:loans", "manage:loans", "read:allowances", "manage:allowances", "read:deductions", "manage:deductions", "read:reports"],
  INSURANCE_OFFICER: ["read:dashboard", "read:employees", "read:insurance", "manage:insurance", "read:documents", "read:reports"],
  SOCIAL_INSURANCE_OFFICER: ["read:dashboard", "read:employees", "read:social-insurance", "manage:social-insurance", "read:payroll", "read:documents", "read:reports"],
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

// Full Cascade Access: modules whose sub-elements should automatically
// receive matching access whenever the parent module permission is granted
// to a user, so an admin never has to remember to also grant every child
// resource by hand. Extend this map as more hierarchical relationships are
// formalized -- deliberately scoped to well-established parent/child pairs
// rather than guessed, since over-granting is a real security cost.
const CASCADE_CHILDREN: Record<string, string[]> = {
  hospitals: ["branches", "departments"]
};

/** Expands a grant list so any parent-module permission also grants the
 * matching action on its cascade children (see CASCADE_CHILDREN). A
 * "manage" grant additionally cascades "read" on the child, mirroring how
 * hasPermission() already treats manage as implying read for one resource. */
function withCascadedGrants(grants: PermissionKey[]): PermissionKey[] {
  const expanded = new Set(grants);
  for (const key of grants) {
    const [action, resource] = key.split(":");
    const children = CASCADE_CHILDREN[resource];
    if (!children) continue;
    for (const child of children) {
      expanded.add(`${action}:${child}` as PermissionKey);
      if (action === "manage") expanded.add(`read:${child}` as PermissionKey);
    }
  }
  return normalizePermissionList(Array.from(expanded));
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
  const setting = await withQueryTiming("permissions.appSetting.findUnique(enterprise.userPermissions)", () =>
    prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null)
  );
  return normalizeStore(setting?.value);
}

export async function savePermissionStore(store: UserPermissionStore) {
  return withQueryTiming("permissions.appSetting.upsert(enterprise.userPermissions)", () =>
    prisma.appSetting.upsert({
      where: { key: STORE_KEY },
      update: { value: store },
      create: { key: STORE_KEY, value: store, description: "Direct per-user enterprise permissions and overrides" }
    })
  );
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

  // Anyone currently named as an approver on any active ApprovalPath stage,
  // or holding an active SupervisorAssignment, automatically gets "requests"
  // access -- derived live, never written into the grants store below, so
  // removing them revokes it the instant they're no longer named anywhere.
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  if (employee) {
    const [approverStage, supervisorAssignment] = await Promise.all([
      prisma.approvalStage.findFirst({ where: { approverEmployeeId: employee.id, approvalPath: { isActive: true } }, select: { id: true } }),
      prisma.supervisorAssignment.findFirst({ where: { employeeId: employee.id, isActive: true }, select: { id: true } })
    ]);
    if (approverStage || supervisorAssignment) {
      base.add("read:requests");
      base.add("manage:requests");
    }
  }

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

/** Union of every read/manage permission key granted to `roles` via the DB
 * RolePermission table, merged with the per-user grant/deny overlay. */
export async function getEffectivePermissionsForRoles(roles: string[], userId?: string): Promise<string[]> {
  if (roles.includes("SUPER_ADMIN")) return ["*:*"];
  const rows = roles.length
    ? await withQueryTiming(`permissions.rolePermission.findMany(roles=${roles.join(",")})`, () =>
        prisma.rolePermission.findMany({
          where: { role: { name: { in: roles } } },
          select: { permission: { select: { action: true, resource: true } } }
        })
      )
    : [];
  const basePermissions = Array.from(new Set(rows.map((row) => `${row.permission.action}:${row.permission.resource}`)));
  return mergeEffectivePermissions(basePermissions, userId);
}

export async function getCachedEffectivePermissions(userId: string, roles: string[]): Promise<string[]> {
  return memoryCache(`effective-permissions:${userId}`, 30 * 1000, () => getEffectivePermissionsForRoles(roles, userId));
}

export function invalidateEffectivePermissions(userId: string) {
  clearMemoryCache(`effective-permissions:${userId}`);
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
    grants: withCascadedGrants(normalizePermissionList(grants)),
    denies: normalizePermissionList(denies),
    temporaryGrants: temporaryGrants ?? previous.temporaryGrants ?? {}
  };
  store.users[targetUserId] = next;
  await savePermissionStore(store);
  invalidateEffectivePermissions(targetUserId);
  await writeAuditLog({
    actorUserId,
    action: "permissions:update",
    entity: "userPermission",
    entityId: targetUserId,
    metadata: { previous, next, ip, reason }
  });
  return next;
}
