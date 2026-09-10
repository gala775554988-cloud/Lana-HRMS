export function canManagePermissionAdministration(
  roles: string[] | undefined,
  permissions: string[] | undefined,
) {
  return Boolean(
    roles?.includes("SUPER_ADMIN") ||
    permissions?.includes("*:*") ||
    permissions?.includes("manage:permissions"),
  );
}

