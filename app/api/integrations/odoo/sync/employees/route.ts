import { NextRequest } from "next/server";
import { runOdooEntitySync } from "../_shared/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Vercel: Allow long sync for 8000 employees - 5 minutes
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return runOdooEntitySync(request, "employees");
}
