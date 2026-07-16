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
  const { userId, module, scope, branchId, departmentId, hospitalId } = await req.json();
  if (!userId || !module || !scope) {
    return NextResponse.json({ error: "Missing required fields: userId, module, or scope" }, { status: 400 });
  }
  if (scope === "BRANCH" && !branchId) {
    return NextResponse.json({ error: "Target branch is required when scope is BRANCH" }, { status: 400 });
  }
  if (scope === "DEPARTMENT" && !departmentId) {
    return NextResponse.json({ error: "Target department is required when scope is DEPARTMENT" }, { status: 400 });
  }
  if (scope === "HOSPITAL" && !hospitalId) {
    return NextResponse.json({ error: "Target hospital is required when scope is HOSPITAL" }, { status: 400 });
  }
  await setUserScope(userId, module, scope, branchId, departmentId, hospitalId, session.user.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing scope id" }, { status: 400 });
  await prisma.hrPermissionScope.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
