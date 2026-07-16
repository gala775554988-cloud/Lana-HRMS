import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { PERMISSION_CATEGORIES, getEffectivePermissionsForRoles } from "@/lib/enterprise/permissions";
import { hrmsModules } from "@/config/hrms";

/**
 * Read-only "View As" preview: computes exactly what a target user's role +
 * direct-permission grants resolve to (permissions, nav modules) WITHOUT
 * ever creating a session as that user. The admin stays in their own
 * session the whole time -- this only reads and reports.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const callerRoles = (session.user.roles as string[]) ?? [];
  if (!callerRoles.includes("SUPER_ADMIN")) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const targetUserId = request.nextUrl.searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });

  const [employee, userRoleRows] = await Promise.all([
    prisma.employee.findFirst({
      where: { userId: targetUserId },
      select: { employeeNumber: true, firstName: true, lastName: true, department: { select: { name: true } }, branch: { select: { name: true } } }
    }),
    prisma.userRole.findMany({ where: { userId: targetUserId }, select: { role: { select: { name: true } } } })
  ]);

  const targetRoles = userRoleRows.map((row) => row.role.name);
  const effectivePermissions = await getEffectivePermissionsForRoles(targetRoles, targetUserId);
  const isSuperAdmin = targetRoles.includes("SUPER_ADMIN");

  const categories = PERMISSION_CATEGORIES.map((category) => ({
    key: category.key,
    title: category.title,
    permissions: category.permissions.map((permission) => {
      const [action, resource] = permission.split(":");
      return { key: permission, granted: hasPermission(effectivePermissions, { action, resource }, targetRoles) };
    })
  }));

  const modules = hrmsModules.map((module) => ({
    key: module.key,
    title: module.title,
    visible: hasPermission(effectivePermissions, { action: "read", resource: module.permissionResource }, targetRoles)
  }));

  return NextResponse.json({
    success: true,
    employee: employee
      ? { name: `${employee.firstName} ${employee.lastName}`, employeeNumber: employee.employeeNumber, department: employee.department?.name ?? null, branch: employee.branch?.name ?? null }
      : null,
    roles: targetRoles,
    isSuperAdmin,
    effectivePermissions,
    categories,
    modules
  });
}
