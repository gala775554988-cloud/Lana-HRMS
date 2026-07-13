import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const jobs = await prisma.schedulerRecord.findMany({ where: { status: "ACTIVE", OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }] }, take: Math.min(Number(body.limit || 20), 100), orderBy: { updatedAt: "asc" } });
  const run = [];
  for (const job of jobs) run.push(await prisma.schedulerRecord.update({ where: { id: job.id }, data: { lastRunAt: new Date(), nextRunAt: new Date(Date.now() + 300000), history: { lastStatus: "DONE", at: new Date().toISOString() } } }));
  return NextResponse.json({ success: true, run });
}
