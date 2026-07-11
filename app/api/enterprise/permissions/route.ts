import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ALL_ENTERPRISE_PERMISSIONS, PERMISSION_CATEGORIES, PERMISSION_TEMPLATES, getPermissionStore, setUserPermissions, type PermissionKey } from "@/lib/enterprise/permissions";

function isSuperAdmin(roles: string[] | undefined) {
  return Boolean(roles?.includes("SUPER_ADMIN"));
}

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const [employees, store] = await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        userId: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
        user: { select: { id: true, name: true, email: true, roles: { include: { role: true } } } }
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500
    }),
    getPermissionStore()
  ]);

  return NextResponse.json({
    success: true,
    employees: employees.filter((employee) => employee.userId),
    permissions: ALL_ENTERPRISE_PERMISSIONS,
    categories: PERMISSION_CATEGORIES,
    templates: PERMISSION_TEMPLATES,
    userPermissions: store.users
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

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
  if (operation === "remove-all") {
    grants = [];
    denies = [];
    temporaryGrants = {};
  }
  if (operation === "template" && body.template) grants = PERMISSION_TEMPLATES[body.template] ?? grants;
  if (operation === "copy" && body.sourceUserId) grants = store.users[body.sourceUserId]?.grants ?? [];
  if (operation === "reset-default") {
    grants = [];
    denies = [];
    temporaryGrants = {};
  }
  if (body.temporaryGrant) temporaryGrants = { ...temporaryGrants, [body.temporaryGrant.permission]: body.temporaryGrant.expiresAt };

  const result = await setUserPermissions({
    actorUserId: session.user.id,
    targetUserId: body.targetUserId,
    grants,
    denies,
    temporaryGrants,
    ip: getClientIp(request),
    reason: operation
  });

  return NextResponse.json({ success: true, permissions: result });
}
