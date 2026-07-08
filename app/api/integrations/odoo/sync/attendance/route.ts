import { NextRequest } from "next/server";
import { runOdooEntitySync } from "../_shared/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  return runOdooEntitySync(request, "attendance");
}
