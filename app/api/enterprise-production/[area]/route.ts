import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProductionArea } from "@/lib/enterprise-production/catalog";
import { listProductionRecords } from "@/lib/enterprise-production/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ area: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { area } = await params;
  if (!getProductionArea(area)) return NextResponse.json({ error: "Unknown area" }, { status: 404 });
  const rows = await listProductionRecords(area, request.nextUrl.searchParams.get("search") || "");
  return NextResponse.json({ success: true, rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ area: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { area } = await params;
  const meta = getProductionArea(area);
  if (!meta) return NextResponse.json({ error: "Unknown area" }, { status: 404 });
  const body = await request.json();
  const code = String(body.code || Date.now());
  const name = String(body.name || code);
  const feature = String(body.feature || meta.features[0]);
  const config = body.config || { enabled: true };
  const record = await prisma.productionAreaRecord.upsert({
    where: { area_feature_code: { area, feature, code } },
    update: { name, description: body.description || null, status: body.status || "ACTIVE", config, metrics: body.metrics || null },
    create: { area, feature, code, name, description: body.description || null, status: body.status || "ACTIVE", config, metrics: body.metrics || null }
  });
  return NextResponse.json({ success: true, record });
}
