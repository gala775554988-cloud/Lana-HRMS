import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewLeave } from "@/lib/enterprise/leave-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** All APPROVED leave requests overlapping a given month, for the leave
 * calendar view. `month` is 1-indexed (1 = January) to match how the UI's
 * <select> naturally presents months. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewLeave(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const departmentId = searchParams.get("departmentId") || undefined;
  const branchId = searchParams.get("branchId") || undefined;

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
      employee: {
        ...(departmentId ? { departmentId } : {}),
        ...(branchId ? { branchId } : {})
      }
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      leaveType: { select: { name: true, code: true } },
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } }
    },
    orderBy: { startDate: "asc" }
  });

  return NextResponse.json({
    success: true,
    year,
    month,
    leaves: leaves.map((l) => ({
      id: l.id,
      startDate: l.startDate,
      endDate: l.endDate,
      leaveTypeName: l.leaveType.name,
      leaveTypeCode: l.leaveType.code,
      employeeId: l.employee.id,
      employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
      employeeNumber: l.employee.employeeNumber
    }))
  });
}
