import { GET as getAnalytics } from "@/app/api/enterprise/lana-ai/analytics/route";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct alias for `/api/lana/analytics` routing to `/api/enterprise/lana-ai/analytics`.
 */
export async function GET(request: NextRequest) {
  return getAnalytics(request);
}
