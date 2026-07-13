import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  try {
    const item = await prisma.notificationPipelineRecord.create({ data: { channel: "PUSH", queueName: "mobile-push", recipient: String(body.deviceId || body.userId || "mobile"), payload: body.payload || {}, status: "PENDING" } });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json({ success: true, queued: false, message: error instanceof Error ? error.message : String(error) });
  }
}
