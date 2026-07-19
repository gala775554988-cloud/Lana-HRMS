import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateMultiDeviceOverrideCache } from "@/lib/cache/device-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add a new user/employee to the multi-device + unbind control table and
 * grant `canUseMultipleDevices` immediately (Request: "إضافة الموظف ومنحه
 * الصلاحية فوراً"). SUPER_ADMIN only, same gate as PATCH below. Returns the
 * row shape `MultiDeviceAccessClient` expects so it can be inserted into the
 * live table without a full page refresh.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const roles: string[] = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ success: false, message: "غير مصرح: صلاحية Super Admin مطلوبة" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : undefined;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
  if (!userId) {
    return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
  }

  const target = await prisma.user.update({
    where: { id: userId },
    data: { canUseMultipleDevices: enabled },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      canUseMultipleDevices: true,
      roles: { select: { role: { select: { name: true } } } },
      employeeProfile: { select: { employeeNumber: true, firstName: true, lastName: true } }
    }
  }).catch(() => null);
  if (!target) {
    return NextResponse.json({ success: false, message: "المستخدم غير موجود" }, { status: 404 });
  }
  invalidateMultiDeviceOverrideCache();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: enabled ? "auth:multi_device_override_enabled" : "auth:multi_device_override_disabled",
    entity: "User",
    entityId: userId,
    metadata: { targetUser: target.name || target.username || userId, enabled }
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message: "تمت إضافة الموظف ومنح الصلاحية بنجاح",
    user: {
      id: target.id,
      name: target.name,
      username: target.username,
      email: target.email,
      canUseMultipleDevices: target.canUseMultipleDevices,
      roleNames: Array.from(new Set(target.roles.map((r) => r.role.name))),
      employeeLabel: target.employeeProfile ? `${target.employeeProfile.firstName} ${target.employeeProfile.lastName} (${target.employeeProfile.employeeNumber})` : null
    }
  });
}

/**
 * Toggle `User.canUseMultipleDevices` (Request A: multi-device permission
 * override). SUPER_ADMIN only -- this grants a real security bypass on the
 * single-device login lock, so it gets the same gate as role assignment.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const roles: string[] = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ success: false, message: "غير مصرح: صلاحية Super Admin مطلوبة" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : undefined;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  if (!userId || enabled === undefined) {
    return NextResponse.json({ success: false, message: "userId and enabled are required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, username: true } });
  if (!target) {
    return NextResponse.json({ success: false, message: "المستخدم غير موجود" }, { status: 404 });
  }

  await prisma.user.update({ where: { id: userId }, data: { canUseMultipleDevices: enabled } });
  invalidateMultiDeviceOverrideCache();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: enabled ? "auth:multi_device_override_enabled" : "auth:multi_device_override_disabled",
    entity: "User",
    entityId: userId,
    metadata: { targetUser: target.name || target.username || userId, enabled }
  }).catch(() => {});

  return NextResponse.json({ success: true, message: enabled ? "تم تفعيل تعدد الأجهزة لهذا المستخدم" : "تم تعطيل تعدد الأجهزة لهذا المستخدم" });
}
