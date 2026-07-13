import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const events = await prisma.eventStoreRecord.findMany({ where: { ...(body.stream ? { stream: String(body.stream) } : {}), status: { in: ["PENDING", "FAILED"] } }, take: Math.min(Number(body.limit || 20), 100), orderBy: { createdAt: "asc" } });
  const replayed = [];
  for (const event of events) replayed.push(await prisma.eventStoreRecord.update({ where: { id: event.id }, data: { status: "REPLAYED", replayedAt: new Date(), attempts: { increment: 1 } } }));
  return NextResponse.json({ success: true, replayed });
}
