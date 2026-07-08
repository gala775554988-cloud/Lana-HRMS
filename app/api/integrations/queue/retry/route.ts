import { NextRequest, NextResponse } from "next/server";
import { retryDeadLetter } from "@/lib/integrations/service";

export async function POST(request: NextRequest) {
  const { id } = await request.json();
  return NextResponse.json({ success: true, result: await retryDeadLetter(id) });
}
