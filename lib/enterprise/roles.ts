import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { ALL_ENTERPRISE_PERMISSIONS, PERMISSION_TEMPLATES, invalidateEffectivePermissions, type PermissionTemplateKey } from "@/lib/enterprise/permissions";
import { withQueryTiming } from "@/lib/perf/query-timer";

function normalizeRoleName(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeKeys(keys: string[] | undefined) {
  const valid = new Set<string>(ALL_ENTERPRISE_PERMISSIONS);
  return Array.from(new Set((keys ?? []).filter((key) => valid.has(key)))).sort();
}

async function permissionIdsFor(keys: string[]) {
  const ids: string[] = [];
  for (const key of keys) {
    const [action, resource] = key.split(":");
    if (!action || !resource) continue;
    const permission = await prisma.permission.upsert({
      where: { action_resource: { action, resource } },
      update: {},
      create: { action, resource, description: `${action} ${resource}` }
    });
    ids.push(permission.id);
  }
  return ids;
}

export async function listRoles() {
  const roles = await withQueryTiming("roles.role.findMany(withPermissions)", () =>
    prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: { select: { action: true, resource: true } } } },
        _count: { select: { users: true } }
      }
    })
  );
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissionKeys: role.permissions.map((rp) => `${rp.permission.action}:${rp.permission.resource}`).sort()
  }));
}

export async function createRole({
  actorUserId,
  name,
  description,
  templateKey,
  permissionKeys
}: {
  actorUserId: string;
  name: string;
  description?: string;
  templateKey?: PermissionTemplateKey;
  permissionKeys?: string[];
}) {
  const normalizedName = normalizeRoleName(name);
  if (!normalizedName) throw new Error("Role name is required");
  const existing = await prisma.role.findUnique({ where: { name: normalizedName } });
  if (existing) throw new Error("A role with this name already exists");

  const startingKeys = permissionKeys?.length ? permissionKeys : templateKey ? PERMISSION_TEMPLATES[templateKey] : [];
  const keys = normalizeKeys(startingKeys);

  const role = await withQueryTiming("roles.role.create", () =>
    prisma.role.create({ data: { name: normalizedName, description: description?.trim() || null, isSystem: false } })
  );
  const permissionIds = await permissionIdsFor(keys);
  if (permissionIds.length) {
    await withQueryTiming("roles.rolePermission.createMany", () =>
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true
      })
    );
  }
  await writeAuditLog({
    actorUserId,
    action: "role:create",
    entity: "role",
    entityId: role.id,
    metadata: { name: normalizedName, description: description ?? null, permissionKeys: keys }
  });
  return role;
}

export async function updateRoleDetails({
  actorUserId,
  roleId,
  name,
  description
}: {
  actorUserId: string;
  roleId: string;
  name?: string;
  description?: string;
}) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Role not found");

  const data: { name?: string; description?: string | null } = {};
  if (typeof description === "string") data.description = description.trim() || null;
  if (typeof name === "string" && name.trim()) {
    const normalizedName = normalizeRoleName(name);
    if (normalizedName !== role.name) {
      if (role.isSystem) throw new Error("Cannot rename a system role");
      const existing = await prisma.role.findUnique({ where: { name: normalizedName } });
      if (existing && existing.id !== roleId) throw new Error("A role with this name already exists");
      data.name = normalizedName;
    }
  }

  const updated = await prisma.role.update({ where: { id: roleId }, data });
  await writeAuditLog({
    actorUserId,
    action: "role:update",
    entity: "role",
    entityId: roleId,
    metadata: { before: { name: role.name, description: role.description }, after: data }
  });
  return updated;
}

export async function updateRolePermissions({
  actorUserId,
  roleId,
  permissionKeys
}: {
  actorUserId: string;
  roleId: string;
  permissionKeys: string[];
}) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Role not found");

  const keys = normalizeKeys(permissionKeys);
  const before = await withQueryTiming("roles.rolePermission.findMany(before)", () =>
    prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { action: true, resource: true } } }
    })
  );
  const beforeKeys = before.map((row) => `${row.permission.action}:${row.permission.resource}`).sort();

  const permissionIds = await permissionIdsFor(keys);
  await withQueryTiming("roles.rolePermission.replace(transaction)", () =>
    prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissionIds.length
        ? [prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) })]
        : [])
    ])
  );

  const affectedUsers = await withQueryTiming("roles.userRole.findMany(affected)", () =>
    prisma.userRole.findMany({ where: { roleId }, select: { userId: true } })
  );
  for (const { userId } of affectedUsers) invalidateEffectivePermissions(userId);

  await writeAuditLog({
    actorUserId,
    action: "role:update-permissions",
    entity: "role",
    entityId: roleId,
    metadata: { before: beforeKeys, after: keys }
  });
  return { permissionKeys: keys };
}

export async function deleteRole({ actorUserId, roleId }: { actorUserId: string; roleId: string }) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) throw new Error("Role not found");
  if (role.isSystem) throw new Error("Cannot delete a system role");
  if (role._count.users > 0) throw new Error("Cannot delete a role that is still assigned to users");

  await withQueryTiming("roles.role.delete", () => prisma.role.delete({ where: { id: roleId } }));
  await writeAuditLog({ actorUserId, action: "role:delete", entity: "role", entityId: roleId, metadata: { name: role.name } });
}

export async function assignRole({ actorUserId, roleId, userId }: { actorUserId: string; roleId: string; userId: string }) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Role not found");
  await withQueryTiming("roles.userRole.upsert(assign)", () =>
    prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId }
    })
  );
  invalidateEffectivePermissions(userId);
  await writeAuditLog({ actorUserId, action: "role:assign", entity: "userRole", entityId: userId, metadata: { roleId, roleName: role.name } });
}

export async function unassignRole({ actorUserId, roleId, userId }: { actorUserId: string; roleId: string; userId: string }) {
  await withQueryTiming("roles.userRole.deleteMany(unassign)", () => prisma.userRole.deleteMany({ where: { userId, roleId } }));
  invalidateEffectivePermissions(userId);
  await writeAuditLog({ actorUserId, action: "role:unassign", entity: "userRole", entityId: userId, metadata: { roleId } });
}
