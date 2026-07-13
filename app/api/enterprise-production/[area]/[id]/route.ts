import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProductionArea } from "@/lib/enterprise-production/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ area: string; id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { area, id } = await params;
  const meta = getProductionArea(area);
  if (!meta) return NextResponse.json({ error: "Unknown area" }, { status: 404 });
  const delegate = (prisma as any)[meta.model];
  const record = await delegate.findUnique({ where: { id } }).catch(() => null);
  return record ? NextResponse.json({ success: true, record }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ area: string; id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { area, id } = await params;
  const meta = getProductionArea(area);
  if (!meta) return NextResponse.json({ error: "Unknown area" }, { status: 404 });
  const delegate = (prisma as any)[meta.model];
  await delegate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
