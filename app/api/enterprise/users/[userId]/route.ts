import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function canManageUsers(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || permissions?.includes("*:*") || permissions?.includes("manage:users"));
}

function tempPassword() {
  return `Lana@${Math.random().toString(36).slice(2, 8)}${Math.floor(100 + Math.random() * 900)}`;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  const body = await request.json() as { action?: string; password?: string; reason?: string };
  const db = prisma as any;
  let generatedPassword: string | undefined;
  let data: any = {};

  switch (body.action) {
    case "reset-password": {
      generatedPassword = body.password || tempPassword();
      data = { passwordHash: await hashPassword(generatedPassword), passwordChangedAt: new Date(), mustChangePassword: true };
      break;
    }
    case "force-password-change": data = { mustChangePassword: true }; break;
    case "unlock-account": data = { isLocked: false, lockedAt: null, lockReason: null }; break;
    case "disable-account": data = { isActive: false, status: "DISABLED", disabledAt: new Date() }; break;
    case "enable-account": data = { isActive: true, status: "ACTIVE", disabledAt: null }; break;
    default: return NextResponse.json({ success: false, message: "Unsupported action" }, { status: 400 });
  }

  const user = await db.user.update({ where: { id: userId }, data, select: { id: true, username: true, email: true, name: true, isActive: true, status: true, isLocked: true, mustChangePassword: true } });
  await db.auditPermissionLog.create({ data: { actorUserId: session.user.id, targetUserId: userId, action: `account:${body.action}`, newValue: data, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(), userAgent: request.headers.get("user-agent"), reason: body.reason } }).catch(() => undefined);
  return NextResponse.json({ success: true, user, generatedPassword });
}
