import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deviceId = String(body.deviceId || "unknown");
  try {
    const record = await prisma.mobilePlatformRecord.upsert({ where: { deviceId }, update: { lastSyncAt: new Date(), offlineCursor: String(body.cursor || ""), metadata: body.payload || {} }, create: { deviceId, platform: String(body.platform || "mobile"), lastSyncAt: new Date(), offlineCursor: String(body.cursor || ""), metadata: body.payload || {} } });
    return NextResponse.json({ success: true, cursor: record.updatedAt.toISOString(), record });
  } catch (error) {
    return NextResponse.json({ success: true, cursor: new Date().toISOString(), offline: true, message: error instanceof Error ? error.message : String(error) });
  }
}
