import { prisma } from "@/lib/prisma";

type PermissionMap = Record<string, string[]>;
type ScopeMap = Record<string, { scope: string; branchId?: string | null; departmentId?: string | null }>;

const permissionCache = new Map<string, { roles: string[]; permissions: PermissionMap; scope: ScopeMap; ts: number }>();
const CACHE_TTL = 60_000;

export async function getPermissionProfile(userId: string) {
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  const [userRoles, scopes] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true, permissions: { select: { permission: { select: { action: true, resource: true } } } } } } },
    }),
    prisma.hrPermissionScope.findMany({ where: { userId } }),
  ]);

  const roles = [...new Set(userRoles.map((ur) => ur.role.name))];
  const perms: PermissionMap = {};
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      const { action, resource } = rp.permission;
      if (!perms[resource]) perms[resource] = [];
      if (!perms[resource].includes(action)) perms[resource].push(action);
    }
  }
  if (roles.includes("SUPER_ADMIN")) perms["*"] = ["*:*"];

  const scope: ScopeMap = {};
  for (const s of scopes) scope[s.module] = { scope: s.scope, branchId: s.branchId, departmentId: s.departmentId };

  const result = { roles, permissions: perms, scope, ts: Date.now() };
  permissionCache.set(userId, result);
  return result;
}

export function clearPermissionCache(userId?: string) {
  if (userId) permissionCache.delete(userId); else permissionCache.clear();
}

export async function canAccessModule(userId: string, module: string, action: string = "read") {
  const profile = await getPermissionProfile(userId);
  if (profile.roles.includes("SUPER_ADMIN")) return true;
  return (profile.permissions[module] || profile.permissions["*"] || []).some((p: string) => p === "*:*" || p === action);
}

export async function getEmployeeScopeWhere(userId: string): Promise<Record<string, unknown>> {
  const profile = await getPermissionProfile(userId);
  if (profile.roles.includes("SUPER_ADMIN")) return {};
  const empScope = profile.scope["employees"];
  if (!empScope || empScope.scope === "ALL") return {};
  if (empScope.scope === "SELF") {
    const self = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
    return self ? { id: self.id } : { id: "__NO_ACCESS__" };
  }
  if (empScope.scope === "BRANCH") return empScope.branchId ? { branchId: empScope.branchId } : {};
  if (empScope.scope === "DEPARTMENT") return empScope.departmentId ? { departmentId: empScope.departmentId } : {};
  if (empScope.scope === "TEAM") {
    const self = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
    return self ? { managerId: self.id } : { id: "__NO_ACCESS__" };
  }
  return {};
}

export async function getApprovalChain(module: string) {
  return prisma.hrApprovalChain.findMany({ where: { module, isActive: true }, orderBy: { level: "asc" } });
}

export type ApprovalChainLevelInput = {
  level: number;
  approverRole: string;
  approverUserId?: string | null;
  scopeType?: string;
  scopeId?: string | null;
  capabilities?: string[];
};

export async function saveApprovalChain(module: string, approvals: ApprovalChainLevelInput[]) {
  await prisma.hrApprovalChain.deleteMany({ where: { module } });
  for (const a of approvals) {
    await prisma.hrApprovalChain.create({
      data: {
        module,
        level: a.level,
        approverRole: a.approverRole,
        approverUserId: a.approverUserId || null,
        scopeType: a.scopeType || "GLOBAL",
        scopeId: a.scopeId || "",
        capabilities: a.capabilities?.length ? a.capabilities : ["VIEW", "APPROVE", "REJECT"]
      }
    });
  }
  return getApprovalChain(module);
}

export const MODULES = ["employees","attendance","payroll","leaves","loans","overtime","documents","contracts","reports","settings","permissions","audit-logs","integrations"] as const;
export const SCOPES = ["ALL","BRANCH","DEPARTMENT","HOSPITAL","TEAM","SELF"] as const;
export const APPROVER_ROLES = ["DIRECT_MANAGER","DEPARTMENT_MANAGER","BRANCH_MANAGER","HR_MANAGER","SUPER_ADMIN"] as const;

export async function setUserScope(userId: string, module: string, scope: string, branchId?: string | null, departmentId?: string | null, hospitalId?: string | null, actorUserId?: string) {
  const existing = await prisma.hrPermissionScope.findUnique({ where: { userId_module: { userId, module } } });
  const data = { scope, branchId: branchId || null, departmentId: departmentId || null, hospitalId: hospitalId || null };
  if (existing) {
    await prisma.hrPermissionScope.update({ where: { id: existing.id }, data });
  } else {
    await prisma.hrPermissionScope.create({ data: { userId, module, ...data } });
  }
  clearPermissionCache(userId);
  if (actorUserId) await prisma.hrPermissionAudit.create({ data: { userId, action: "SET_SCOPE", module, oldValue: existing?.scope || "NONE", newValue: scope, byUserId: actorUserId } });
}

export async function getAllUserScopes(page = 1, pageSize = 30, search?: string) {
  const [scopesRaw, total] = await Promise.all([
    prisma.hrPermissionScope.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.hrPermissionScope.count(),
  ]);

  const userIds = Array.from(new Set(scopesRaw.map((s) => s.userId).filter(Boolean)));
  const branchIds = Array.from(new Set(scopesRaw.map((s) => s.branchId).filter(Boolean) as string[]));
  const deptIds = Array.from(new Set(scopesRaw.map((s) => s.departmentId).filter(Boolean) as string[]));
  const hospitalIds = Array.from(new Set(scopesRaw.map((s) => (s as any).hospitalId).filter(Boolean) as string[]));

  const [employees, branches, depts, hospitals] = await Promise.all([
    userIds.length > 0 ? prisma.employee.findMany({ where: { userId: { in: userIds } }, select: { userId: true, firstName: true, lastName: true, employeeNumber: true } }) : [],
    branchIds.length > 0 ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [],
    deptIds.length > 0 ? prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : [],
    hospitalIds.length > 0 ? prisma.hospital.findMany({ where: { id: { in: hospitalIds } }, select: { id: true, name: true } }) : []
  ]);

  const empMap = new Map(employees.map((e) => [e.userId!, `${e.firstName} ${e.lastName} - ${e.employeeNumber}`]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h.name]));

  const scopes = scopesRaw.map((s) => ({
    ...s,
    userLabel: empMap.get(s.userId) || `مستخدم (${s.userId.slice(0, 8)})`,
    branchName: s.branchId ? branchMap.get(s.branchId) || s.branchId : null,
    departmentName: s.departmentId ? deptMap.get(s.departmentId) || s.departmentId : null,
    hospitalName: (s as any).hospitalId ? hospitalMap.get((s as any).hospitalId) || (s as any).hospitalId : null
  }));

  return { scopes, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
}
