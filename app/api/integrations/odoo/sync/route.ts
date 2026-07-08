import { NextRequest, NextResponse } from "next/server";
import { enqueueSync, syncMapping } from "@/lib/integrations/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const direction = body.direction || "BIDIRECTIONAL";
    const result = body.queue ? await enqueueSync({ connectionId: body.connectionId, mappingId: body.mappingId, direction }) : await syncMapping(body.connectionId, body.mappingId, direction);
    return NextResponse.json({ success: true, result });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
