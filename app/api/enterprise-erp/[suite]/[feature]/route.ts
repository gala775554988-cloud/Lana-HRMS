import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getErpSuite } from "@/lib/enterprise-erp/catalog";
import { listErpRecords } from "@/lib/enterprise-erp/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ suite: string; feature: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { suite, feature } = await params;
  const meta = getErpSuite(suite);
  if (!meta || !meta.features.includes(feature as never)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  const rows = await listErpRecords(suite, feature, request.nextUrl.searchParams.get("search") || "");
  return NextResponse.json({ success: true, rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ suite: string; feature: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { suite, feature } = await params;
  const meta = getErpSuite(suite);
  if (!meta || !meta.features.includes(feature as never)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  const body = await request.json();
  const code = String(body.code);
  const record = await prisma.enterprisePlatformRecord.upsert({
    where: { tenantId_suite_feature_code: { tenantId: body.tenantId || null, suite, feature, code } },
    update: { name: String(body.name || code), status: String(body.status || "ACTIVE"), priority: String(body.priority || "NORMAL"), payload: body.payload || {}, workflow: body.workflow || null, approvals: body.approvals || null, metrics: body.metrics || null },
    create: { tenantId: body.tenantId || null, suite, feature, code, name: String(body.name || code), status: String(body.status || "ACTIVE"), priority: String(body.priority || "NORMAL"), payload: body.payload || {}, workflow: body.workflow || null, approvals: body.approvals || null, metrics: body.metrics || null }
  });
  return NextResponse.json({ success: true, record });
}
