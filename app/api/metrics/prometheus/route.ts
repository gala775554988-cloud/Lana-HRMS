import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [connectors] = await Promise.all([
    prisma.infrastructureConnector.count().catch(() => 0)
  ]);
  const body = [`lana_connectors_total ${connectors}`].join("\n") + "\n";
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; version=0.0.4" } });
}
