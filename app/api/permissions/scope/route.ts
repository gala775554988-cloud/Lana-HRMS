import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { setUserScope, getAllUserScopes } from "@/lib/permissions/engine";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const search = req.nextUrl.searchParams.get("search") || undefined;
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const data = await getAllUserScopes(page, 30, search);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId, module, scope, branchId, departmentId } = await req.json();
  await setUserScope(userId, module, scope, branchId, departmentId, session.user.id);
  return NextResponse.json({ success: true });
}
