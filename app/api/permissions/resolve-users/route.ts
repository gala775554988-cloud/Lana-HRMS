import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resolves a batch of userIds to display labels for the approval-chain and
 * permissions admin screens, which store only userId but need to render a
 * human-readable name for the person assigned to a level/grant. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) ?? [];
  if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { userIds?: unknown };
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id): id is string => typeof id === "string") : [];
  if (!userIds.length) return NextResponse.json({ success: true, labels: {} });

  const employees = await prisma.employee.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, employeeNumber: true, firstName: true, lastName: true, profilePhotoUrl: true, department: { select: { name: true } } }
  });

  const labels: Record<string, string> = {};
  for (const employee of employees) {
    if (employee.userId) labels[employee.userId] = `${employee.firstName} ${employee.lastName} - ${employee.employeeNumber}`;
  }
  return NextResponse.json({ success: true, labels, employees });
}
