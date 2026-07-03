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
  permission: PermissionCheck
) {
  return Boolean(userPermissions?.includes(toPermissionKey(permission)));
}

export async function requirePermission(permission: PermissionCheck) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.permissions, permission)) {
    throw new Error("Forbidden");
  }

  return session;
}
