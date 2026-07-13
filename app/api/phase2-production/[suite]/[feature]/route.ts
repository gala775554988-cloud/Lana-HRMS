import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPhase2Suite } from "@/lib/phase2/catalog";
import { listPhase2Records } from "@/lib/phase2/store";

function key(suite: string, feature: string) { return `PHASE2_PRODUCTION_${suite}_${feature}`.toUpperCase(); }

export async function GET(request: NextRequest, { params }: { params: Promise<{ suite: string; feature: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { suite, feature } = await params;
  const meta = getPhase2Suite(suite);
  if (!meta || !meta.features.includes(feature as never)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  const rows = await listPhase2Records(suite, feature, request.nextUrl.searchParams.get("search") || "");
  return NextResponse.json({ success: true, rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ suite: string; feature: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { suite, feature } = await params;
  const meta = getPhase2Suite(suite);
  if (!meta || !meta.features.includes(feature as never)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  const body = await request.json();
  const current = await prisma.appSetting.findUnique({ where: { key: key(suite, feature) } }).catch(() => null);
  const existing = current?.value && typeof current.value === "object" && Array.isArray((current.value as { records?: unknown }).records) ? (current.value as { records: any[] }).records : [];
  const now = new Date().toISOString();
  const code = String(body.code);
  const record = { id: `${suite}-${feature}-${code}`, code, name: String(body.name || code), status: String(body.status || "ACTIVE"), payload: body.payload || {}, createdAt: now, updatedAt: now };
  const records = [...existing.filter((item) => item.code !== code), record];
  await prisma.appSetting.upsert({ where: { key: key(suite, feature) }, update: { value: { suite, feature, records } }, create: { key: key(suite, feature), value: { suite, feature, records }, description: `${suite}/${feature}` } });
  return NextResponse.json({ success: true, record });
}
