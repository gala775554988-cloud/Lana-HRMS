import { NextRequest, NextResponse } from "next/server";
import { processIntegrationQueue } from "@/lib/integrations/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await processIntegrationQueue(Number(body.limit || 10));
  return NextResponse.json({ success: true, result });
}
