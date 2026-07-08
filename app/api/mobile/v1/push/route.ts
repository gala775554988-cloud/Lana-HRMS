import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const item = await prisma.notificationPipelineRecord.create({ data: { channel: "PUSH", queueName: "mobile-push", recipient: String(body.deviceId || body.userId || "mobile"), payload: body.payload || {}, status: "PENDING" } });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json({ success: true, queued: false, message: error instanceof Error ? error.message : String(error) });
  }
}
