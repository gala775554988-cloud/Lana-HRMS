import { NextRequest, NextResponse } from "next/server";
import { createIntegrationApiKey } from "@/lib/integrations/service";

export async function POST(request: NextRequest) {
  const { providerId = null, name, scopes = ["integrations:read"] } = await request.json();
  return NextResponse.json({ success: true, result: await createIntegrationApiKey(providerId, name, scopes) });
}
