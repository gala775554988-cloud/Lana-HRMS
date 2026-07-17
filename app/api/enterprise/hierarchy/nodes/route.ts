import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(roles: string[] | undefined) {
  const roleSet = new Set(roles ?? []);
  return roleSet.has("SUPER_ADMIN") || roleSet.has("HR_MANAGER") || roleSet.has("PAYROLL_MANAGER");
}

/**
 * Expand-on-Click Lazy Loading Endpoint for Organization Hierarchy:
 * Fetches only the direct children (subordinates) for a targeted parent employee (`parentId`)
 * or department/branch (`departmentId` / `branchId`).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!isAuthorized(session.user.roles as string[] | undefined)) {
      // Allow any active employee to read hierarchy nodes for viewing the chart if needed
    }

    const parentId = request.nextUrl.searchParams.get("parentId") || undefined;
    const departmentId = request.nextUrl.searchParams.get("departmentId") || undefined;
    const branchId = request.nextUrl.searchParams.get("branchId") || undefined;
    const rootOnly = request.nextUrl.searchParams.get("rootOnly") === "true";

    const where: Record<string, unknown> = { status: "ACTIVE" };

    if (parentId) {
      where.managerId = parentId;
    } else if (departmentId && rootOnly) {
      where.departmentId = departmentId;
      where.managerId = null;
    } else if (departmentId) {
      where.departmentId = departmentId;
    } else if (branchId && rootOnly) {
      where.branchId = branchId;
      where.managerId = null;
    } else if (branchId) {
      where.branchId = branchId;
    } else if (rootOnly) {
      where.managerId = null;
    }

    const nodes = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        branchId: true,
        departmentId: true,
        positionId: true,
        managerId: true,
        profilePhotoUrl: true,
        position: { select: { title: true, code: true } },
        department: { select: { name: true, code: true } },
        branch: { select: { name: true, code: true } },
        _count: {
          select: {
            managedEmployees: { where: { status: "ACTIVE" } }
          }
        }
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 200
    });

    const formattedNodes = nodes.map((n) => ({
      id: n.id,
      employeeNumber: n.employeeNumber,
      firstName: n.firstName,
      lastName: n.lastName,
      name: `${n.firstName} ${n.lastName}`.trim(),
      branchId: n.branchId,
      departmentId: n.departmentId,
      positionId: n.positionId,
      managerId: n.managerId,
      profilePhotoUrl: n.profilePhotoUrl,
      positionTitle: n.position?.title || "بدون منصب",
      departmentName: n.department?.name || "بدون قسم",
      branchName: n.branch?.name || "الفرع الرئيسي",
      childrenCount: n._count.managedEmployees
    }));

    return NextResponse.json({ success: true, nodes: formattedNodes, count: formattedNodes.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
