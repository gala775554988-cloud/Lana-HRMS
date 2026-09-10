import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listRoles, createRole } from "@/lib/enterprise/roles";
import { PERMISSION_CATEGORIES, PERMISSION_TEMPLATES, buildPermissionTree } from "@/lib/enterprise/permissions";
import { canManagePermissionAdministration } from "@/lib/enterprise/permissions-admin";

async function requirePermissionAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!canManagePermissionAdministration((session.user as any).roles, (session.user as any).permissions)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { session } as const;
}

export async function GET() {
  const { error } = await requirePermissionAdmin();
  if (error) return error;
  const roles = await listRoles();
  return NextResponse.json({
    roles,
    categories: PERMISSION_CATEGORIES,
    tree: buildPermissionTree(PERMISSION_CATEGORIES),
    templateKeys: Object.keys(PERMISSION_TEMPLATES),
    templates: PERMISSION_TEMPLATES,
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requirePermissionAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  try {
    const role = await createRole({
      actorUserId: session!.user.id as string,
      name: String(body.name ?? ""),
      description: typeof body.description === "string" ? body.description : undefined,
      templateKey: typeof body.templateKey === "string" ? body.templateKey : undefined,
      permissionKeys: Array.isArray(body.permissionKeys) ? body.permissionKeys : undefined
    });
    return NextResponse.json({ success: true, role });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Failed to create role" }, { status: 400 });
  }
}
