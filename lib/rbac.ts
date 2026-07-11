import { auth } from "@/auth";

export type PermissionCheck = {
  action: string;
  resource: string;
};

export function toPermissionKey(permission: PermissionCheck) {
  return `${permission.action}:${permission.resource}`;
}

export function hasRole(userRoles: string[] | undefined, role: string) {
  return Boolean(userRoles?.includes(role));
}

export function hasPermission(
  userPermissions: string[] | undefined,
  permission: PermissionCheck,
  userRoles?: string[]
) {
  if (userRoles?.includes("SUPER_ADMIN") || userPermissions?.includes("SUPER_ADMIN") || userPermissions?.includes("*:*") ) return true;

  const normalized = new Set((userPermissions ?? []).map((value) => value.toLowerCase()));
  const action = permission.action.toLowerCase();
  const resource = permission.resource.toLowerCase();
  if (normalized.has(`${action}:${resource}`)) return true;

  // Compatibility with Enterprise seed actions (View/Create/Edit/etc.) while
  // runtime checks use read/manage. This is the root of leave-requests 403
  // when DB contains View:leave but runtime checks read:leave.
  if (action === "read" && normalized.has(`view:${resource}`)) return true;
  if (action === "manage") {
    return ["manage", "edit", "create", "update", "delete", "approve", "reject"].some((alias) => normalized.has(`${alias}:${resource}`));
  }

  return false;
}

export async function requirePermission(permission: PermissionCheck) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.permissions, permission, session.user.roles as string[] | undefined)) {
    throw new Error("Forbidden");
  }

  return session;
}
