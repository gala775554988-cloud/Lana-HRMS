import { NextRequest, NextResponse } from "next/server";
import { createIntegrationApiKey } from "@/lib/integrations/service";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const { providerId = null, name, scopes = ["integrations:read"] } = await request.json();
    return NextResponse.json({ success: true, result: await createIntegrationApiKey(providerId, name, scopes) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
