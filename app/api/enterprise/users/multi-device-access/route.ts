import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateMultiDeviceOverrideCache } from "@/lib/cache/device-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
