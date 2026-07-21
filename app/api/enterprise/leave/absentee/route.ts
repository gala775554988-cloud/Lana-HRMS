import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { canViewLeave } from "@/lib/enterprise/leave-permissions";
import { getAbsentEmployees } from "@/lib/enterprise/leave-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Absentee report: everyone on APPROVED leave covering a given date
 * (defaults to today), optionally scoped to a department/branch. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewLeave(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(date.getTime())) return NextResponse.json({ success: false, message: "Invalid date" }, { status: 400 });

  const departmentId = searchParams.get("departmentId") || undefined;
  const branchId = searchParams.get("branchId") || undefined;

  const absentees = await getAbsentEmployees(date, { departmentId, branchId });

  return NextResponse.json({
    success: true,
    date: date.toISOString().slice(0, 10),
    count: absentees.length,
    absentees: absentees.map((a) => ({
      id: a.id,
      employeeId: a.employee.id,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
      employeeNumber: a.employee.employeeNumber,
      departmentName: a.employee.department?.name ?? null,
      branchName: a.employee.branch?.name ?? null,
      leaveTypeName: a.leaveType.name,
      startDate: a.startDate,
      endDate: a.endDate
    }))
  });
}
