import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccessProfile, applyScopedWhere } from "@/lib/enterprise/hierarchy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Universal employee lookup used by the global Cmd+K search -- searches by
 * employee number, name, or national ID from anywhere in the app. Results
 * are scoped through the same applyScopedWhere used by the /employees page
 * itself, so a non-admin never sees an employee they couldn't already see
 * on the employees list.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (search.length < 2) return NextResponse.json({ success: true, employees: [] });

  const roles = (session.user.roles as string[]) ?? [];
  const accessProfile = roles.includes("SUPER_ADMIN")
    ? { isSuperAdmin: true, isHrManager: false, userId: session.user.id, roles, employee: null, store: {} as any }
    : await getAccessProfile(session.user.id, roles);

  const baseWhere = {
    OR: [
      { firstName: { contains: search, mode: "insensitive" as const } },
      { lastName: { contains: search, mode: "insensitive" as const } },
      { employeeNumber: { contains: search, mode: "insensitive" as const } },
      { nationalId: { contains: search, mode: "insensitive" as const } }
    ]
  };
  const where = await applyScopedWhere("employees", baseWhere, accessProfile);

  const employees = await prisma.employee.findMany({
    where,
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      profilePhotoUrl: true,
      department: { select: { name: true } },
      position: { select: { title: true } }
    }
  });

  return NextResponse.json({ success: true, employees });
}
