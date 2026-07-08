import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const events = await prisma.eventStoreRecord.findMany({ where: { ...(body.stream ? { stream: String(body.stream) } : {}), status: { in: ["PENDING", "FAILED"] } }, take: Math.min(Number(body.limit || 20), 100), orderBy: { createdAt: "asc" } });
  const replayed = [];
  for (const event of events) replayed.push(await prisma.eventStoreRecord.update({ where: { id: event.id }, data: { status: "REPLAYED", replayedAt: new Date(), attempts: { increment: 1 } } }));
  return NextResponse.json({ success: true, replayed });
}
