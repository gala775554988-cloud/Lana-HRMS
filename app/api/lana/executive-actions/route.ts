import { POST as executeActions } from "@/app/api/enterprise/lana-ai/executive-actions/route";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct alias for `/api/lana/executive-actions` routing to `/api/enterprise/lana-ai/executive-actions`.
 */
export async function POST(request: NextRequest) {
  return executeActions(request);
}
