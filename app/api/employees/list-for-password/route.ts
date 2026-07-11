import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user.roles as string[]) || [];
    const permissions = (session.user.permissions as string[]) || [];
    const isSuperAdmin = roles.includes("SUPER_ADMIN");
    const isHRManager = roles.includes("HR_MANAGER");
    const hasManagePermission = hasPermission(permissions, { action: "manage", resource: "employees" }, roles);

    if (!isSuperAdmin && !isHRManager && !hasManagePermission) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const take = Math.min(Number(searchParams.get("take") || 100), 500);

    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { employeeNumber: { contains: search, mode: "insensitive" } },
        { nationalId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        employeeNumber: true,
        nationalId: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        department: { select: { name: true } },
        user: {
          select: {
            id: true,
            mustChangePassword: true,
            passwordChanged: true,
            passwordChangedAt: true,
            lastPasswordResetAt: true,
            lastPasswordResetBy: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, employees });
  } catch (error) {
    console.error("[list-for-password] error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
