import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureEnterpriseRbacSeed, type PermissionKey } from "@/lib/enterprise/permissions";

function canManagePermissions(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || permissions?.includes("*:*") || permissions?.includes("manage:permissions"));
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManagePermissions(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  await ensureEnterpriseRbacSeed().catch(() => undefined);
  const { roleId } = await params;
  const body = await request.json() as { permissions?: PermissionKey[]; description?: string; name?: string };
  const permissionKeys = Array.from(new Set((body.permissions ?? []).filter((key): key is PermissionKey => typeof key === "string" && key.includes(":"))));
  const db = prisma as any;

  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, isEditable: true, permissions: { select: { permission: { select: { key: true, action: true, resource: true } } } } },
  });
  if (!role) return NextResponse.json({ success: false, message: "Role not found" }, { status: 404 });
  if (role.name === "SUPER_ADMIN" && !permissionKeys.includes("*:*" as PermissionKey)) {
    // SUPER_ADMIN remains protected by runtime *:* even when its visible matrix is edited.
  }

  const permissionRows = permissionKeys.length
    ? await db.permission.findMany({
        where: { OR: permissionKeys.map((key) => {
          const [action, ...rest] = key.split(":");
          return { action, resource: rest.join(":") };
        }) },
        select: { id: true, key: true, action: true, resource: true },
      })
    : [];

  const previous = role.permissions.map((item: any) => item.permission.key ?? `${item.permission.action}:${item.permission.resource}`).sort();
  await db.$transaction([
    db.role.update({ where: { id: roleId }, data: { description: body.description ?? undefined, name: body.name ?? undefined } }),
    db.rolePermission.deleteMany({ where: { roleId } }),
    ...(permissionRows.length ? [db.rolePermission.createMany({ data: permissionRows.map((permission: any) => ({ roleId, permissionId: permission.id })), skipDuplicates: true })] : []),
  ]);

  const next = permissionRows.map((permission: any) => permission.key ?? `${permission.action}:${permission.resource}`).sort();
  await db.auditPermissionLog.create({
    data: {
      actorUserId: session.user.id,
      targetUserId: session.user.id,
      action: "role-permissions:update",
      oldValue: { roleId, roleName: role.name, permissions: previous },
      newValue: { roleId, roleName: body.name ?? role.name, permissions: next },
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
      device: request.headers.get("user-agent"),
      reason: "role-editor",
    },
  }).catch(() => undefined);

  return NextResponse.json({ success: true, role: { id: roleId, name: body.name ?? role.name, permissions: next } });
}
