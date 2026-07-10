import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ALL_ENTERPRISE_PERMISSIONS,
  ENTERPRISE_ROLES,
  PERMISSION_CATEGORIES,
  PERMISSION_TEMPLATES,
  ensureEnterpriseRbacSeed,
  getPermissionStore,
  getUserPermissionProfile,
  setUserPermissions,
  type PermissionKey,
} from "@/lib/enterprise/permissions";

function hasPermission(permissions: string[] | undefined, key: string) {
  return Boolean(permissions?.includes("*:*") || permissions?.includes(key));
}

function canManagePermissions(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || hasPermission(permissions, "manage:permissions"));
}

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManagePermissions(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  await ensureEnterpriseRbacSeed().catch(() => undefined);

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? 50)));
  const search = searchParams.get("search")?.trim() ?? "";
  const department = searchParams.get("department")?.trim() ?? "";

  const where: any = {
    userId: { not: null },
    ...(department ? { department: { name: { contains: department, mode: "insensitive" } } } : {}),
    ...(search ? { OR: [
      { employeeNumber: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { user: { username: { contains: search, mode: "insensitive" } } },
    ] } : {}),
  };

  const [employees, total, store, roles, auditLogs, profile] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true, employeeNumber: true, firstName: true, lastName: true, email: true, userId: true, status: true, archivedAt: true,
        department: { select: { name: true } }, branch: { select: { name: true } },
        user: { select: { id: true, username: true, name: true, email: true, isActive: true, status: true, isLocked: true, lastLoginAt: true, loginCount: true, passwordChangedAt: true, mustChangePassword: true, lockReason: true, roles: { select: { role: { select: { id: true, name: true } } } } } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
    getPermissionStore(),
    prisma.role.findMany({ select: { id: true, name: true, description: true, isSystem: true, isEditable: true, permissions: { select: { permission: { select: { key: true, action: true, resource: true } } } } }, orderBy: { name: "asc" } }).catch(() => []),
    (prisma as any).auditPermissionLog.findMany({
      select: { id: true, action: true, oldValue: true, newValue: true, ipAddress: true, userAgent: true, reason: true, createdAt: true, actor: { select: { name: true, email: true, username: true } }, target: { select: { name: true, email: true, username: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }).catch(() => []),
    targetUserId ? getUserPermissionProfile(targetUserId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    success: true,
    employees,
    pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    permissions: ALL_ENTERPRISE_PERMISSIONS,
    categories: PERMISSION_CATEGORIES,
    templates: PERMISSION_TEMPLATES,
    enterpriseRoles: ENTERPRISE_ROLES,
    roles: roles.map((role: any) => ({ ...role, permissions: role.permissions.map((item: any) => item.permission.key ?? `${item.permission.action}:${item.permission.resource}`) })),
    userPermissions: store.users,
    profile,
    auditLogs,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManagePermissions(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    targetUserId?: string;
    grants?: PermissionKey[];
    denies?: PermissionKey[];
    template?: keyof typeof PERMISSION_TEMPLATES;
    operation?: "replace" | "grant-all" | "remove-all" | "template" | "copy" | "reset-default";
    sourceUserId?: string;
    temporaryGrant?: { permission: PermissionKey; expiresAt: string };
  };

  if (!body.targetUserId) return NextResponse.json({ success: false, message: "targetUserId is required" }, { status: 400 });
  const store = await getPermissionStore();
  const current = store.users[body.targetUserId] ?? { grants: [], denies: [], temporaryGrants: {} };
  let grants = body.grants ?? current.grants;
  let denies = body.denies ?? current.denies;
  let temporaryGrants = current.temporaryGrants ?? {};
  const operation = body.operation ?? "replace";

  if (operation === "grant-all") grants = ALL_ENTERPRISE_PERMISSIONS;
  if (operation === "remove-all" || operation === "reset-default") { grants = []; denies = []; temporaryGrants = {}; }
  if (operation === "template" && body.template) grants = PERMISSION_TEMPLATES[body.template] ?? grants;
  if (operation === "copy" && body.sourceUserId) grants = store.users[body.sourceUserId]?.grants ?? [];
  if (body.temporaryGrant) temporaryGrants = { ...temporaryGrants, [body.temporaryGrant.permission]: body.temporaryGrant.expiresAt };

  const result = await setUserPermissions({
    actorUserId: session.user.id,
    targetUserId: body.targetUserId,
    grants,
    denies,
    temporaryGrants,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    reason: operation,
  });

  return NextResponse.json({ success: true, permissions: result, profile: await getUserPermissionProfile(body.targetUserId) });
}
