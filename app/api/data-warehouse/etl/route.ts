import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const record = await prisma.dataWarehouseRecord.create({ data: { pipeline: String(body.pipeline || "default"), layer: String(body.layer || "bronze"), dataset: String(body.dataset || Date.now()), partition: body.partition || null, rowsCount: Number(body.rowsCount || 0), schemaJson: body.schemaJson || {}, metrics: body.metrics || {}, loadedAt: new Date(), status: "READY" } });
    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json({ success: true, loaded: false, message: error instanceof Error ? error.message : String(error) });
  }
}
