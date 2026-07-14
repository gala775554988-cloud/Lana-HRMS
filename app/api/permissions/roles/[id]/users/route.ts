import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { assignRole, unassignRole } from "@/lib/enterprise/roles";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN")) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { session } as const;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  if (!userId) return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
  try {
    await assignRole({ actorUserId: session!.user.id as string, roleId: id, userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Failed to assign role" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  if (!userId) return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
  try {
    await unassignRole({ actorUserId: session!.user.id as string, roleId: id, userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Failed to unassign role" }, { status: 400 });
  }
}
