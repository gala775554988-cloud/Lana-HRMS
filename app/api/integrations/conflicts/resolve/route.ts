import { NextRequest, NextResponse } from "next/server";
import { resolveConflict } from "@/lib/integrations/service";

export async function POST(request: NextRequest) {
  const { id, resolution, resolvedValue } = await request.json();
  return NextResponse.json({ success: true, result: await resolveConflict(id, resolution, resolvedValue) });
}
