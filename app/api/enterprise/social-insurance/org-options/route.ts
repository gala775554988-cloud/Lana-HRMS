import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Lookup lists for the Social Insurance reports filters (branch/department/
// nationality) -- a small dedicated endpoint rather than reusing the
// SUPER_ADMIN-only /api/enterprise/org-entities, since Social Insurance
// read access is meant to also cover SOCIAL_INSURANCE_OFFICER.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const allowed = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "social-insurance" }, roles);
  if (!allowed) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const [branches, departments, nationalities] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.nationality.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);

  return NextResponse.json({ success: true, branches, departments, nationalities });
}
