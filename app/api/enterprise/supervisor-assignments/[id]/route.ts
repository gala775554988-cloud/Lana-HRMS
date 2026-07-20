import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateEffectivePermissions } from "@/lib/enterprise/permissions";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session } as const;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const existing = await prisma.supervisorAssignment.findUnique({ where: { id }, select: { employeeId: true } });
    if (!existing) throw new Error("التكليف غير موجود");

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.trim() || null;
    if (body.startDate) data.startDate = new Date(body.startDate);
    if ("endDate" in body) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    await prisma.supervisorAssignment.update({ where: { id }, data });

    const employee = await prisma.employee.findUnique({ where: { id: existing.employeeId }, select: { userId: true } });
    if (employee?.userId) invalidateEffectivePermissions(employee.userId);

    await writeAuditLog({ actorUserId: session!.user.id as string, action: "supervisor-assignment:update", entity: "supervisorAssignment", entityId: id, metadata: { changes: Object.keys(data) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "فشل تعديل التكليف" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  try {
    const existing = await prisma.supervisorAssignment.findUnique({ where: { id }, select: { employeeId: true } });
    await prisma.supervisorAssignment.delete({ where: { id } });
    if (existing) {
      const employee = await prisma.employee.findUnique({ where: { id: existing.employeeId }, select: { userId: true } });
      if (employee?.userId) invalidateEffectivePermissions(employee.userId);
    }
    await writeAuditLog({ actorUserId: session!.user.id as string, action: "supervisor-assignment:delete", entity: "supervisorAssignment", entityId: id, metadata: {} });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "فشل حذف التكليف" }, { status: 400 });
  }
}
