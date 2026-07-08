import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
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
