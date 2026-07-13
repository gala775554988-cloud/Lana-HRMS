import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const query = String(body.query || "");
  try {
    if (query.includes("enterprisePlatformRecords")) {
      const records = await prisma.enterprisePlatformRecord.findMany({ take: 50, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ data: { enterprisePlatformRecords: records } });
    }
    if (query.includes("tenants")) {
      const tenants = await prisma.tenant.findMany({ take: 50, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ data: { tenants } });
    }
  } catch (error) {
    return NextResponse.json({ data: { health: "DEGRADED" }, errors: [{ message: error instanceof Error ? error.message : String(error) }] });
  }
  return NextResponse.json({ data: { health: "OK" } });
}

export async function GET() {
  return NextResponse.json({ endpoint: "/api/graphql", operations: ["enterprisePlatformRecords", "tenants", "health"] });
}
