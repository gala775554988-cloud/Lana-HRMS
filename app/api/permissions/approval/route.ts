import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getApprovalChain, saveApprovalChain } from "@/lib/permissions/engine";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleName = req.nextUrl.searchParams.get("module") || "leave";
  return NextResponse.json(await getApprovalChain(moduleName));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { module, approvals } = await req.json();
  return NextResponse.json(await saveApprovalChain(module, approvals));
}
