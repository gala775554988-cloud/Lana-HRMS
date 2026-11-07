import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureExpiryNotificationsForUser } from "@/lib/enterprise/notifications";
import { ensureSocialInsuranceAlertsForUser } from "@/lib/enterprise/social-insurance";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  await ensureExpiryNotificationsForUser(session.user.id).catch(() => null);
  await ensureSocialInsuranceAlertsForUser(session.user.id, (session.user.roles as string[] | undefined) ?? []).catch(() => null);

  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const where = {
    ...(status === "read" || status === "unread" ? { userId: session.user.id } : { OR: [{ userId: session.user.id }, { userId: null }] }),
    ...(status === "unread" ? { readAt: null } : {}),
    ...(status === "read" ? { readAt: { not: null } } : {})
  };
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } })
  ]);
  return NextResponse.json({ success: true, notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; all?: boolean } | null;
  if (body?.all === true) {
    await prisma.notification.updateMany({ where: { userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ success: true });
  }
  if (typeof body?.id !== "string" || !body.id.trim()) return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
  await prisma.notification.updateMany({ where: { id: body.id, userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ success: true });
}
