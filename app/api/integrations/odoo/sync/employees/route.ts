import { NextRequest } from "next/server";
import { runOdooEntitySync } from "../_shared/handler";

export async function POST(request: NextRequest) {
  return runOdooEntitySync(request, "employees");
}
