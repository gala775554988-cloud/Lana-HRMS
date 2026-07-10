import { NextResponse } from "next/server";
import { getSystemHealthReport } from "@/lib/system/health";

export async function GET() {
  const report = await getSystemHealthReport();
  return NextResponse.json({
    status: report.status,
    timestamp: report.checkedAt,
    version: report.version,
    summary: report.summary,
    checks: report.items.map((item) => ({ key: item.key, status: item.status, message: item.message })),
  }, { status: report.status === "ERROR" ? 503 : 200 });
}
