import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canManageEmployees(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || permissions?.includes("*:*") || permissions?.includes("manage:employees") || permissions?.includes("archive:employees") || permissions?.includes("restore:employees"));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageEmployees(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const { employeeId } = await params;
  const body = await request.json() as { action?: string };
  const data = body.action === "archive-employee" ? { archivedAt: new Date(), status: "INACTIVE" as const } : body.action === "restore-employee" ? { archivedAt: null, status: "ACTIVE" as const } : null;
  if (!data) return NextResponse.json({ success: false, message: "Unsupported action" }, { status: 400 });
  const employee = await (prisma as any).employee.update({ where: { id: employeeId }, data, select: { id: true, employeeNumber: true, firstName: true, lastName: true, status: true, archivedAt: true, userId: true } });
  if (employee.userId) await (prisma as any).auditPermissionLog.create({ data: { actorUserId: session.user.id, targetUserId: employee.userId, action: `employee:${body.action}`, newValue: data, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(), userAgent: request.headers.get("user-agent") } }).catch(() => undefined);
  return NextResponse.json({ success: true, employee });
}
