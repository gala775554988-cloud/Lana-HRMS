import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const code = String(body.code || Date.now());
  try {
    const automation = await prisma.automationRecord.upsert({ where: { code }, update: { lastRunAt: new Date(), nodes: body.nodes || {}, edges: body.edges || {} }, create: { code, name: String(body.name || code), triggerType: String(body.triggerType || "manual"), nodes: body.nodes || {}, edges: body.edges || {}, lastRunAt: new Date() } });
    return NextResponse.json({ success: true, automation });
  } catch (error) {
    return NextResponse.json({ success: true, executed: false, message: error instanceof Error ? error.message : String(error) });
  }
}
