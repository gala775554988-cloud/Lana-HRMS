import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") || undefined;
  const scenarios = await prisma.digitalTwinScenario.findMany({ where: type ? { type } : {}, orderBy: { updatedAt: "desc" }, take: 100 }).catch(() => []);
  return NextResponse.json({ success: true, scenarios });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  let company = await prisma.digitalTwinCompany.findFirst({ where: { tenantId: null, code: String(body.companyCode || "default") } });
  if (!company) company = await prisma.digitalTwinCompany.create({ data: { code: String(body.companyCode || "default"), name: String(body.companyName || "Digital Twin"), baseline: body.baseline || {} } });
  const confidence = Math.min(0.95, 0.6 + Object.keys(body.input || {}).length * 0.05);
  const scenario = await prisma.digitalTwinScenario.create({ data: { companyId: company.id, type: String(body.type || "organization-simulation"), name: String(body.name || "Scenario"), input: body.input || {}, output: { simulatedAt: new Date().toISOString(), impact: body.input || {} }, confidence, riskScore: 1 - confidence, recommendation: `Scenario confidence ${Math.round(confidence * 100)}%` } });
  return NextResponse.json({ success: true, scenario });
}
