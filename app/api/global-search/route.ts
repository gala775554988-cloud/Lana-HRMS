import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const needle = { contains: q, mode: "insensitive" as const };
  const rows = await prisma.globalSearchDocument.findMany({ where: q ? { OR: [{ title: needle }, { content: needle }, { ocrText: needle }, { entity: needle }] } : {}, orderBy: { rank: "desc" }, take: 50 }).catch(() => []);
  return NextResponse.json({ success: true, rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const row = await prisma.globalSearchDocument.upsert({ where: { tenantId_entity_entityId: { tenantId: body.tenantId || "", entity: String(body.entity), entityId: String(body.entityId) } }, update: { title: String(body.title), content: String(body.content || ""), ocrText: body.ocrText || null, facets: body.facets || {}, vector: body.vector || null }, create: { tenantId: body.tenantId || "", entity: String(body.entity), entityId: String(body.entityId), title: String(body.title), content: String(body.content || ""), ocrText: body.ocrText || null, facets: body.facets || {}, vector: body.vector || null, url: body.url || null, rank: Number(body.rank || 0) } });
  return NextResponse.json({ success: true, row });
}
