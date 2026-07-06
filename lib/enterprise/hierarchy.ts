import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function getAccessProfile(userId: string, roles: string[] = []): Promise<AccessProfile> {
  const [employee, store] = await Promise.all([
    prisma.employee.findFirst({ where: { userId }, select: { id: true, userId: true, departmentId: true, branchId: true } }),
    getHierarchyStore()
  ]);
  return {
    userId,
    roles,
    employee,
    store,
    isSuperAdmin: roles.includes("SUPER_ADMIN"),
    isHrManager: roles.includes("HR_MANAGER")
  };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
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

export async function resolveApprovalChain(employeeId: string) {
  const [employee, store] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, userId: true, departmentId: true, branchId: true } }),
    getHierarchyStore()
  ]);
  if (!employee) return [];

  const directManagerId = store.directManagers[employee.id];
  const branchManagerId = employee.branchId ? store.branchManagers[employee.branchId] : undefined;
  const departmentManagerId = employee.departmentId ? store.departmentManagers[employee.departmentId] : undefined;

  const [directManager, branchManagers, departmentManagers, hrManagers] = await Promise.all([
    directManagerId ? prisma.employee.findUnique({ where: { id: directManagerId }, select: { id: true, userId: true } }) : null,
    branchManagerId
      ? prisma.employee.findMany({ where: { id: branchManagerId }, select: { id: true, userId: true } })
      : resolveRoleEmployeeIds(["BRANCH_MANAGER"], { branchId: employee.branchId }),
    departmentManagerId
      ? prisma.employee.findMany({ where: { id: departmentManagerId }, select: { id: true, userId: true } })
      : resolveRoleEmployeeIds(["DEPARTMENT_MANAGER"], { departmentId: employee.departmentId }),
    store.hrManagers.length
      ? prisma.employee.findMany({ where: { id: { in: store.hrManagers } }, select: { id: true, userId: true } })
      : resolveRoleEmployeeIds(["HR_MANAGER"])
  ]);

  return unique([
    directManager?.userId,
    ...branchManagers.map((manager) => manager.userId),
    ...departmentManagers.map((manager) => manager.userId),
    ...hrManagers.map((manager) => manager.userId)
  ]).filter((userId) => userId !== employee.userId);
}
