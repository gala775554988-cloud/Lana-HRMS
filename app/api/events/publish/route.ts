import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const event = await prisma.eventStoreRecord.create({ data: { stream: String(body.stream || "default"), eventType: String(body.eventType || "domain-event"), aggregateType: String(body.aggregateType || "system"), aggregateId: String(body.aggregateId || Date.now()), payload: body.payload || {}, metadata: body.metadata || {} } });
  return NextResponse.json({ success: true, event });
}
