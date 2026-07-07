import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { listHospitals, softDeleteHospital, upsertHospital } from "@/lib/enterprise/hospitals";
import { writeAuditLog } from "@/lib/audit";

function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Hospital API failed";
  return NextResponse.json({ success: false, message }, { status });
}

function canRead(session: any) {
  if (!session?.user) return false;
  const roles = (session.user.roles as string[]) ?? [];
  const permissions = (session.user.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "employees" });
}

function canManage(session: any) {
  if (!session?.user) return false;
  const roles = (session.user.roles as string[]) ?? [];
  const permissions = (session.user.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "manage", resource: "employees" });
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!canRead(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
    const url = new URL(request.url);
    const result = await listHospitals({
      search: url.searchParams.get("search") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      branchId: url.searchParams.get("branchId") ?? undefined,
      isActive: url.searchParams.get("isActive") ?? undefined
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!canManage(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
    const hospital = await upsertHospital(body as any);
    await writeAuditLog({ actorUserId: session!.user.id, action: (body as any).id ? "hospital:update" : "hospital:create", entity: "hospital", entityId: hospital.id, metadata: body as Record<string, unknown> }).catch(() => null);
    return NextResponse.json({ success: true, hospital });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!canManage(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    const hospital = await softDeleteHospital(id);
    await writeAuditLog({ actorUserId: session!.user.id, action: "hospital:soft-delete", entity: "hospital", entityId: id }).catch(() => null);
    return NextResponse.json({ success: true, hospital });
  } catch (error) {
    return jsonError(error);
  }
}
