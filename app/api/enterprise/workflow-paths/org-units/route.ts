import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(roles: string[] | undefined) {
  const roleSet = new Set(roles ?? []);
  return roleSet.has("SUPER_ADMIN") || roleSet.has("HR_MANAGER");
}

/**
 * Flat list of every department/branch/hospital for the workflow-path
 * editor's "الجهة" (org-unit) select -- deliberately its own lightweight
 * endpoint rather than three round trips through the generic HR module API,
 * since this is just id/name pairs for a dropdown, not paginated records.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isAuthorized(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const [departments, branches, hospitals] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);

  return NextResponse.json({ success: true, departments, branches, hospitals });
}
