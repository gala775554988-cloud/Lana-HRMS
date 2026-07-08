import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - started;
    await prisma.platformHealthMetric.create({ data: { service: "api", metric: "healthcheck", value: dbMs, unit: "ms", status: "OK", metadata: { route: "/api/health" } } }).catch(() => null);
    return NextResponse.json({ status: "OK", database: "OK", dbMs, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: "DEGRADED", database: "UNAVAILABLE", message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }, { status: 200 });
  }
}
