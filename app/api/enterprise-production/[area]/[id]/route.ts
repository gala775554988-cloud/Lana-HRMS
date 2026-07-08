import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProductionArea } from "@/lib/enterprise-production/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ area: string; id: string }> }) {
  const { area, id } = await params;
  const meta = getProductionArea(area);
  if (!meta) return NextResponse.json({ error: "Unknown area" }, { status: 404 });
  const delegate = (prisma as any)[meta.model];
  const record = await delegate.findUnique({ where: { id } }).catch(() => null);
  return record ? NextResponse.json({ success: true, record }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ area: string; id: string }> }) {
  const { area, id } = await params;
  const meta = getProductionArea(area);
  if (!meta) return NextResponse.json({ error: "Unknown area" }, { status: 404 });
  const delegate = (prisma as any)[meta.model];
  await delegate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
