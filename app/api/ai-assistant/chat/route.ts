import { NextRequest } from "next/server";
import { POST as runUnifiedLanaChat } from "@/app/api/enterprise/lana-ai/chat/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return runUnifiedLanaChat(request);
}
