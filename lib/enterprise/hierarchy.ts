import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inferEnterpriseRolesFromPosition } from "@/lib/enterprise/role-inference";

// Approval routing and employee-visibility scoping (buildEmployeeScopeWhere/
// resolveApprovalChain) no longer read this store -- they're driven by two
// relational models instead:
//  - SupervisorAssignment: who supervises which entity (hospital/department/
//    branch/project), for how long -- drives live employee-visibility scoping.
//  - ApprovalPath + ApprovalStage: the unlimited, manually-built approval
//    chain per (company, entity type, entity name, request type), see
//    lib/enterprise/approval-engine.ts for the routing resolver.
// The store itself is kept only as the backing data for the separate
// "الهيكل التنظيمي" (organization-hierarchy-client.tsx) direct-manager/
// HR-manager editor and the bulk-import manager linking -- unrelated to
// approval routing.
export type HierarchyStore = {
  version: 1;
  directManagers: Record<string, string>;
  departmentManagers: Record<string, string>;
  branchManagers: Record<string, string>;
  hrManagers: string[];
  projects: Record<string, { name: string; managerEmployeeId?: string; employeeIds: string[] }>;
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
    create: { key: STORE_KEY, value: store, description: "Direct/HR manager mappings for the organization hierarchy editor" }
  });
}

export type AccessProfile = {
  userId: string;
  roles: string[];
  employee: {
    id: string;
    userId: string | null;
    departmentId: string | null;
    branchId: string | null;
    branchIdRaw?: string | null;
    hospitalId?: string | null;
    projectId?: string | null;
    position?: { title: string } | null;
  } | null;
  isSuperAdmin: boolean;
  isHrManager: boolean;
};

export async function getAccessProfile(userId: string, roles: string[] = []): Promise<AccessProfile> {
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true, userId: true, departmentId: true, branchId: true, hospitalId: true, projectId: true, position: { select: { title: true } } }
  });
  const effectiveRoles = Array.from(new Set([...roles, ...inferEnterpriseRolesFromPosition(employee?.position?.title)]));
  return {
    userId,
    roles: effectiveRoles,
    employee,
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

/** Every entity (hospital/department/branch/project) the given employee is
 * currently an ACTIVE supervisor of, right now (respects start/end dates). */
async function getActiveSupervisorAssignments(employeeId: string) {
  const now = new Date();
  return prisma.supervisorAssignment.findMany({
    where: {
      employeeId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }]
    },
    select: { entityType: true, entityId: true }
  });
}

export async function buildEmployeeScopeWhere(profile: AccessProfile): Promise<Prisma.EmployeeWhereInput> {
  if (profile.isSuperAdmin || profile.isHrManager) return {};
  if (!profile.employee) return { id: "__NO_EMPLOYEE_SCOPE__" };

  const scopes: Prisma.EmployeeWhereInput[] = [{ id: profile.employee.id }];

  // Being assigned as supervisor of an entity is what scopes an employee
  // list/dashboard/attendance/leave view down to just that entity's people
  // -- see SupervisorAssignment (independent "تكليفات المشرفين" page).
  const assignments = await getActiveSupervisorAssignments(profile.employee.id);
  for (const assignment of assignments) {
    if (assignment.entityType === "HOSPITAL") scopes.push({ hospitalId: assignment.entityId });
    else if (assignment.entityType === "DEPARTMENT") scopes.push({ departmentId: assignment.entityId });
    else if (assignment.entityType === "BRANCH") scopes.push({ branchId: assignment.entityId });
    else if (assignment.entityType === "PROJECT") scopes.push({ projectId: assignment.entityId });
  }

  // Whoever is actually named as approver on a pending workflow step can see
  // that request's employee, regardless of role -- makes a stage's approver
  // able to see the requests routed to them in /approvals even if they
  // aren't formally a supervisor of the requester's whole entity.
  const assignedInstances = await prisma.workflowInstance.findMany({
    where: { steps: { some: { approverUserId: profile.userId, status: "PENDING" } } },
    select: { employeeId: true },
    distinct: ["employeeId"]
  });
  if (assignedInstances.length) scopes.push({ id: { in: assignedInstances.map((instance) => instance.employeeId) } });

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
    "documents", "contracts", "attendance", "leave-requests", "payroll-items", "loans", "overtime", "allowances", "deductions", "performance", "training-enrollments", "bonuses"
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

/** Resolves the configured ApprovalPath for this employee + request type
 * (see lib/enterprise/approval-engine.ts for the full resolver, which this
 * re-exports for backward-compat call sites). */
export { resolveApprovalChain, type ResolvedApprover } from "@/lib/enterprise/approval-engine";
