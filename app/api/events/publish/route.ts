import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const event = await prisma.eventStoreRecord.create({ data: { stream: String(body.stream || "default"), eventType: String(body.eventType || "domain-event"), aggregateType: String(body.aggregateType || "system"), aggregateId: String(body.aggregateId || Date.now()), payload: body.payload || {}, metadata: body.metadata || {} } });
  return NextResponse.json({ success: true, event });
}
