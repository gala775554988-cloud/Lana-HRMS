import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit || 10), 100);
  const jobs = await prisma.platformBackgroundJob.findMany({ where: { status: "PENDING", runAt: { lte: new Date() } }, take: limit, orderBy: { runAt: "asc" } });
  const processed = [];
  for (const job of jobs) {
    const updated = await prisma.platformBackgroundJob.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: new Date(), finishedAt: new Date(), attempts: { increment: 1 } } });
    processed.push(updated);
  }
  return NextResponse.json({ success: true, processed });
}
