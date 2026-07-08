import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const jobs = await prisma.messageQueueRecord.findMany({ where: { status: { in: ["PENDING", "RETRY"] }, OR: [{ delayedUntil: null }, { delayedUntil: { lte: new Date() } }] }, take: Math.min(Number(body.limit || 20), 100), orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  const processed = [];
  for (const job of jobs) processed.push(await prisma.messageQueueRecord.update({ where: { id: job.id }, data: { status: "DONE", processedAt: new Date(), attempts: { increment: 1 } } }));
  return NextResponse.json({ success: true, processed });
}
