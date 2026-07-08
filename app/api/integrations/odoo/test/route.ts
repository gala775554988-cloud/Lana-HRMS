import { NextRequest, NextResponse } from "next/server";
import { testOdooConnection } from "@/lib/integrations/service";

export async function POST(request: NextRequest) {
  try { const { connectionId } = await request.json(); return NextResponse.json(await testOdooConnection(connectionId)); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
