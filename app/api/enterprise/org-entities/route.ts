import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) } as const;
  }
  return {} as const;
}

// Lookup lists for the Approval Workflows / Supervisor Assignments pickers:
// companies, and the four entity types (hospital/department/branch/project).
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const [companies, hospitals, departments, branches, projects] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);

  return NextResponse.json({ success: true, companies, hospitals, departments, branches, projects });
}
