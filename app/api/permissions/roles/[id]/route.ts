import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateRoleDetails, updateRolePermissions, deleteRole } from "@/lib/enterprise/roles";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN")) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { session } as const;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const actorUserId = session!.user.id as string;
    if (Array.isArray(body.permissionKeys)) {
      await updateRolePermissions({ actorUserId, roleId: id, permissionKeys: body.permissionKeys });
    }
    if (typeof body.name === "string" || typeof body.description === "string") {
      await updateRoleDetails({ actorUserId, roleId: id, name: body.name, description: body.description });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Failed to update role" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  try {
    await deleteRole({ actorUserId: session!.user.id as string, roleId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Failed to delete role" }, { status: 400 });
  }
}
