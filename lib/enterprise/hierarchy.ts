import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inferEnterpriseRolesFromPosition } from "@/lib/enterprise/role-inference";

export type HierarchyStore = {
  version: 1;
  directManagers: Record<string, string>;
  departmentManagers: Record<string, string>;
  branchManagers: Record<string, string>;
  hrManagers: string[];
  projects: Record<string, { name: string; managerEmployeeId?: string; employeeIds: string[] }>;
};

export type AccessProfile = {
  userId: string;
  roles: string[];
  employee: {
    id: string;
    userId: string | null;
    departmentId: string | null;
    branchId: string | null;
    position?: { title: string } | null;
  } | null;
  store: HierarchyStore;
  isSuperAdmin: boolean;
  isHrManager: boolean;
};

const STORE_KEY = "enterprise.hierarchy";

function normalizeStore(value: unknown): HierarchyStore {
  const fallback: HierarchyStore = { version: 1, directManagers: {}, departmentManagers: {}, branchManagers: {}, hrManagers: [], projects: {} };
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<HierarchyStore>;
  return {
    version: 1,
    directManagers: raw.directManagers && typeof raw.directManagers === "object" ? raw.directManagers : {},
    departmentManagers: raw.departmentManagers && typeof raw.departmentManagers === "object" ? raw.departmentManagers : {},
    branchManagers: raw.branchManagers && typeof raw.branchManagers === "object" ? raw.branchManagers : {},
    hrManagers: Array.isArray(raw.hrManagers) ? raw.hrManagers.filter((id): id is string => typeof id === "string") : [],
    projects: raw.projects && typeof raw.projects === "object" ? raw.projects : {}
  };
}

export async function getHierarchyStore(): Promise<HierarchyStore> {
  const setting = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null);
  return normalizeStore(setting?.value);
}

export async function saveHierarchyStore(store: HierarchyStore) {
  return prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    update: { value: store },
    create: { key: STORE_KEY, value: store, description: "Enterprise organization hierarchy mappings" }
  });
}

export async function getAccessProfile(userId: string, roles: string[] = []): Promise<AccessProfile> {
  const [employee, store] = await Promise.all([
    prisma.employee.findFirst({ where: { userId }, select: { id: true, userId: true, departmentId: true, branchId: true, position: { select: { title: true } } } }),
    getHierarchyStore()
  ]);
  const effectiveRoles = Array.from(new Set([...roles, ...inferEnterpriseRolesFromPosition(employee?.position?.title)]));
  return {
    userId,
    roles: effectiveRoles,
    employee,
    store,
    isSuperAdmin: effectiveRoles.includes("SUPER_ADMIN"),
    isHrManager: effectiveRoles.includes("HR_MANAGER")
  };
}

export async function resolveRoleEmployeeIds(roleNames: string[], filters?: { branchId?: string | null; departmentId?: string | null }) {
  const employees = await prisma.employee.findMany({
    where: {
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      user: { roles: { some: { role: { name: { in: roleNames } } } } }
    },
    select: { id: true, userId: true }
  });
  return employees;
}

export async function buildEmployeeScopeWhere(profile: AccessProfile): Promise<Prisma.EmployeeWhereInput> {
  if (profile.isSuperAdmin || profile.isHrManager) return {};
  if (!profile.employee) return { id: "__NO_EMPLOYEE_SCOPE__" };

  const scopes: Prisma.EmployeeWhereInput[] = [{ id: profile.employee.id }];
  const roleSet = new Set(profile.roles);

  if (roleSet.has("SUPERVISOR")) {
    const directReportIds = Object.entries(profile.store.directManagers)
      .filter(([, managerEmployeeId]) => managerEmployeeId === profile.employee?.id)
      .map(([employeeId]) => employeeId);
    scopes.push({ id: { in: directReportIds.length ? directReportIds : ["__NO_DIRECT_REPORTS__"] } });
  }

  if (roleSet.has("BRANCH_MANAGER") && profile.employee.branchId) {
    scopes.push({ branchId: profile.employee.branchId });
  }

  if (roleSet.has("DEPARTMENT_MANAGER") && profile.employee.departmentId) {
    scopes.push({ departmentId: profile.employee.departmentId });
  }

  if (roleSet.has("PROJECT_MANAGER")) {
    const assigned = Object.values(profile.store.projects)
      .filter((project) => project.managerEmployeeId === profile.employee?.id)
      .flatMap((project) => project.employeeIds);
    scopes.push({ id: { in: assigned.length ? assigned : ["__NO_PROJECT_EMPLOYEES__"] } });
  }

  return { OR: scopes };
}

function andWhere<T extends Record<string, unknown>>(base: T, scoped: Record<string, unknown>): T {
  if (!Object.keys(scoped).length) return base;
  if (!Object.keys(base).length) return scoped as T;
  return { AND: [base, scoped] } as unknown as T;
}

export async function applyScopedWhere(resourceKey: string, baseWhere: Record<string, unknown>, profile: AccessProfile) {
  if (profile.isSuperAdmin || profile.isHrManager) return baseWhere;
  const employeeScope = await buildEmployeeScopeWhere(profile);

  if (resourceKey === "employees") return andWhere(baseWhere, employeeScope as Record<string, unknown>);
  if (resourceKey === "branches" && profile.employee?.branchId) return andWhere(baseWhere, { id: profile.employee.branchId });
  if (resourceKey === "departments" && profile.employee?.departmentId) return andWhere(baseWhere, { id: profile.employee.departmentId });

  const employeeIdResources = new Set([
    "documents", "contracts", "attendance", "leave-requests", "payroll-items", "loans", "overtime", "allowances", "deductions", "performance", "training-enrollments"
  ]);
  if (employeeIdResources.has(resourceKey)) return andWhere(baseWhere, { employee: employeeScope });
  if (resourceKey === "assets") return andWhere(baseWhere, { assignedEmployee: employeeScope });
  return baseWhere;
}

export async function canAccessEmployeeId(employeeId: string, profile: AccessProfile) {
  if (profile.isSuperAdmin || profile.isHrManager) return true;
  const count = await prisma.employee.count({ where: { AND: [{ id: employeeId }, await buildEmployeeScopeWhere(profile)] } });
  return count > 0;
}

type ChainEmployee = { id: string; userId: string | null; departmentId: string | null; branchId: string | null; managerId: string | null };

async function resolveRoleForEmployee(role: string, employee: ChainEmployee, store: HierarchyStore): Promise<string[]> {
  if (role === "DIRECT_MANAGER") {
    // Employee.managerId is kept in sync from Odoo automatically -- prefer it
    // over the manually-admin-configured directManagers map, which requires
    // re-entering the same relationship by hand and can drift out of sync.
    const directManagerId = employee.managerId ?? store.directManagers[employee.id];
    if (!directManagerId) return [];
    const manager = await prisma.employee.findUnique({ where: { id: directManagerId }, select: { userId: true } });
    return manager?.userId ? [manager.userId] : [];
  }
  if (role === "BRANCH_MANAGER") {
    const branchManagerId = employee.branchId ? store.branchManagers[employee.branchId] : undefined;
    const managers = branchManagerId
      ? await prisma.employee.findMany({ where: { id: branchManagerId }, select: { userId: true } })
      : await resolveRoleEmployeeIds(["BRANCH_MANAGER"], { branchId: employee.branchId });
    return managers.map((manager) => manager.userId).filter((id): id is string => Boolean(id));
  }
  if (role === "DEPARTMENT_MANAGER") {
    const departmentManagerId = employee.departmentId ? store.departmentManagers[employee.departmentId] : undefined;
    const managers = departmentManagerId
      ? await prisma.employee.findMany({ where: { id: departmentManagerId }, select: { userId: true } })
      : await resolveRoleEmployeeIds(["DEPARTMENT_MANAGER"], { departmentId: employee.departmentId });
    return managers.map((manager) => manager.userId).filter((id): id is string => Boolean(id));
  }
  if (role === "HR_MANAGER") {
    const managers = store.hrManagers.length
      ? await prisma.employee.findMany({ where: { id: { in: store.hrManagers } }, select: { userId: true } })
      : await resolveRoleEmployeeIds(["HR_MANAGER"]);
    return managers.map((manager) => manager.userId).filter((id): id is string => Boolean(id));
  }
  if (role === "SUPER_ADMIN") {
    const admins = await prisma.user.findMany({ where: { roles: { some: { role: { name: "SUPER_ADMIN" } } } }, select: { id: true } });
    return admins.map((admin) => admin.id);
  }
  return [];
}

export type ResolvedApprover = { userId: string; capabilities: string[] };

/** Default hierarchy-based chain (unchanged behavior): direct manager, then
 * branch/department managers, then HR managers -- used whenever no
 * HrApprovalChain rows exist for the given module, or no module is passed. */
async function resolveDefaultChain(employee: ChainEmployee, store: HierarchyStore): Promise<ResolvedApprover[]> {
  const [directManagerIds, branchManagerIds, departmentManagerIds, hrManagerIds] = await Promise.all([
    resolveRoleForEmployee("DIRECT_MANAGER", employee, store),
    resolveRoleForEmployee("BRANCH_MANAGER", employee, store),
    resolveRoleForEmployee("DEPARTMENT_MANAGER", employee, store),
    resolveRoleForEmployee("HR_MANAGER", employee, store)
  ]);
  return [...directManagerIds, ...branchManagerIds, ...departmentManagerIds, ...hrManagerIds].map((userId) => ({ userId, capabilities: ["VIEW", "APPROVE", "REJECT"] }));
}

/** Resolves the admin-configured HrApprovalChain for `module` against this
 * specific employee: for each level number, prefers a scope-specific row
 * (BRANCH/HOSPITAL matching the employee's own branch/hospital) over the
 * GLOBAL row at that level, then resolves it to a concrete userId either
 * directly (approverUserId, used for scoped/named overrides) or via the
 * same role lookup as the default chain. A level with no matching row (e.g.
 * only a scope override exists and it doesn't match this employee) is
 * skipped rather than blocking the whole chain. */
async function resolveConfiguredChain(
  rows: Array<{ level: number; approverRole: string; approverUserId: string | null; scopeType: string; scopeId: string; capabilities: string[] }>,
  employee: ChainEmployee & { hospitalId?: string | null },
  store: HierarchyStore
): Promise<ResolvedApprover[]> {
  const levels = Array.from(new Set(rows.map((row) => row.level))).sort((a, b) => a - b);
  const result: ResolvedApprover[] = [];

  for (const level of levels) {
    const rowsAtLevel = rows.filter((row) => row.level === level);
    const matched =
      rowsAtLevel.find((row) => row.scopeType === "BRANCH" && row.scopeId && row.scopeId === employee.branchId) ??
      rowsAtLevel.find((row) => row.scopeType === "HOSPITAL" && row.scopeId && row.scopeId === employee.hospitalId) ??
      rowsAtLevel.find((row) => row.scopeType === "GLOBAL" || !row.scopeType);
    if (!matched) continue;

    const userIds = matched.approverUserId ? [matched.approverUserId] : await resolveRoleForEmployee(matched.approverRole, employee, store);
    for (const userId of userIds) result.push({ userId, capabilities: matched.capabilities?.length ? matched.capabilities : ["VIEW", "APPROVE", "REJECT"] });
  }
  return result;
}

export async function resolveApprovalChain(employeeId: string, module?: string): Promise<ResolvedApprover[]> {
  const [employee, store] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, userId: true, departmentId: true, branchId: true, managerId: true, hospitalId: true } }),
    getHierarchyStore()
  ]);
  if (!employee) return [];

  let resolved: ResolvedApprover[] = [];
  if (module) {
    const configured = await prisma.hrApprovalChain.findMany({ where: { module, isActive: true }, orderBy: { level: "asc" } });
    if (configured.length) resolved = await resolveConfiguredChain(configured, employee, store);
  }
  if (!resolved.length) resolved = await resolveDefaultChain(employee, store);

  const seen = new Set<string>();
  const deduped: ResolvedApprover[] = [];
  for (const approver of resolved) {
    if (approver.userId === employee.userId || seen.has(approver.userId)) continue;
    seen.add(approver.userId);
    deduped.push(approver);
  }
  return deduped;
}
