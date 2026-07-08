import { NextRequest, NextResponse } from "next/server";
import { getInfraArea } from "@/lib/infra/catalog";
import { listInfraRecords } from "@/lib/infra/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ area: string; feature: string }> }) {
  const { area, feature } = await params;
  const meta = getInfraArea(area);
  if (!meta || !meta.features.includes(feature as never)) return NextResponse.json({ error: "Unknown infrastructure feature" }, { status: 404 });
  const rows = await listInfraRecords(area, feature, request.nextUrl.searchParams.get("search") || "");
  return NextResponse.json({ success: true, rows });
}
