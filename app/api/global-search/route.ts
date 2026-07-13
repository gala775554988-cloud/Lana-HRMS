import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  const needle = { contains: q, mode: "insensitive" as const };
  const rows = await prisma.globalSearchDocument.findMany({ where: q ? { OR: [{ title: needle }, { content: needle }, { ocrText: needle }, { entity: needle }] } : {}, orderBy: { rank: "desc" }, take: 50 }).catch(() => []);
  return NextResponse.json({ success: true, rows });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const row = await prisma.globalSearchDocument.upsert({ where: { tenantId_entity_entityId: { tenantId: body.tenantId || "", entity: String(body.entity), entityId: String(body.entityId) } }, update: { title: String(body.title), content: String(body.content || ""), ocrText: body.ocrText || null, facets: body.facets || {}, vector: body.vector || null }, create: { tenantId: body.tenantId || "", entity: String(body.entity), entityId: String(body.entityId), title: String(body.title), content: String(body.content || ""), ocrText: body.ocrText || null, facets: body.facets || {}, vector: body.vector || null, url: body.url || null, rank: Number(body.rank || 0) } });
  return NextResponse.json({ success: true, row });
}
