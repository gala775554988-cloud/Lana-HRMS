import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureExpiryNotificationsForUser } from "@/lib/enterprise/notifications";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  await ensureExpiryNotificationsForUser(session.user.id).catch(() => null);

  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const where = {
    OR: [{ userId: session.user.id }, { userId: null }],
    ...(status === "unread" ? { readAt: null } : {}),
    ...(status === "read" ? { readAt: { not: null } } : {})
  };
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null } })
  ]);
  return NextResponse.json({ success: true, notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { id?: string; all?: boolean };
  if (body.all) {
    await prisma.notification.updateMany({ where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ success: true });
  }
  if (!body.id) return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
  await prisma.notification.updateMany({ where: { id: body.id, OR: [{ userId: session.user.id }, { userId: null }] }, data: { readAt: new Date() } });
  return NextResponse.json({ success: true });
}
