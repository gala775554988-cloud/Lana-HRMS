import { NextRequest, NextResponse } from "next/server";
import { retryDeadLetter } from "@/lib/integrations/service";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    return NextResponse.json({ success: true, result: await retryDeadLetter(id) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
