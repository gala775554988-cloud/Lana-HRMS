import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEnterpriseFeature } from "@/lib/enterprise-suite/catalog";
import { listEnterpriseRecords } from "@/lib/enterprise-suite/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ suite: string; feature: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { suite, feature } = await params;
  if (!getEnterpriseFeature(suite, feature)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  const rows = await listEnterpriseRecords(suite, feature, request.nextUrl.searchParams.get("search") || "");
  return NextResponse.json({ success: true, rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ suite: string; feature: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { suite, feature } = await params;
  if (!getEnterpriseFeature(suite, feature)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  const body = await request.json();
  const record = await prisma.enterpriseRecord.upsert({
    where: { suite_feature_code: { suite, feature, code: String(body.code) } },
    update: { title: String(body.title), status: String(body.status || "ACTIVE"), priority: String(body.priority || "NORMAL"), data: body.data || {} },
    create: { suite, feature, code: String(body.code), title: String(body.title), status: String(body.status || "ACTIVE"), priority: String(body.priority || "NORMAL"), data: body.data || {} }
  });
  return NextResponse.json({ success: true, record });
}
