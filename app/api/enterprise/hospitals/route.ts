import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { listHospitals, softDeleteHospital, upsertHospital } from "@/lib/enterprise/hospitals";
import { writeAuditLog } from "@/lib/audit";

function canRead(session: any) {
  if (!session?.user) return false;
  const roles = (session.user.roles as string[]) ?? [];
  const permissions = (session.user.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || hasPermission(permissions, { action: "read", resource: "employees" });
}

function canManage(session: any) {
  if (!session?.user) return false;
  const roles = (session.user.roles as string[]) ?? [];
  const permissions = (session.user.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || hasPermission(permissions, { action: "manage", resource: "employees" });
}

export async function GET(request: Request) {
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
}

export async function POST(request: Request) {
  const session = await auth();
  if (!canManage(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
  const body = await request.json();
  const hospital = await upsertHospital(body);
  await writeAuditLog({ actorUserId: session!.user.id, action: body.id ? "hospital:update" : "hospital:create", entity: "hospital", entityId: hospital.id, metadata: body }).catch(() => null);
  return NextResponse.json({ success: true, hospital });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!canManage(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
  const hospital = await softDeleteHospital(id);
  await writeAuditLog({ actorUserId: session!.user.id, action: "hospital:soft-delete", entity: "hospital", entityId: id }).catch(() => null);
  return NextResponse.json({ success: true, hospital });
}
