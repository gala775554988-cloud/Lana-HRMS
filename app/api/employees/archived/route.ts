import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") || 30), 5), 200);
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "archivedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const department = searchParams.get("department");
    const branch = searchParams.get("branch");

    // Archived employees: status INACTIVE or TERMINATED, or archivedAt not null, or terminationDate not null
    const where: any = {
      OR: [
        { status: "INACTIVE" },
        { status: "TERMINATED" },
        { archivedAt: { not: null } },
        { terminationDate: { not: null } },
      ],
    };

    // Search across multiple fields
    if (search) {
      const searchOR = [
        { employeeNumber: { contains: search, mode: "insensitive" } },
        { nationalId: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
      where.AND = where.AND || [];
      where.AND.push({ OR: searchOR });
    }

    if (department) {
      where.department = { name: { contains: department, mode: "insensitive" } };
    }

    if (branch) {
      where.branch = { name: { contains: branch, mode: "insensitive" } };
    }

    const validSortFields = ["firstName", "lastName", "employeeNumber", "hireDate", "terminationDate", "lastActiveDate", "archivedAt", "createdAt", "updatedAt"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "archivedAt";
    const orderBy = { [orderByField]: sortOrder };

    const [records, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          employeeNumber: true,
          nationalId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          hireDate: true,
          terminationDate: true,
          lastActiveDate: true,
          lastActiveSource: true,
          archivedAt: true,
          archiveReason: true,
          department: { select: { name: true, code: true } },
          position: { select: { title: true } },
          branch: { select: { name: true, code: true } },
          manager: { select: { firstName: true, lastName: true, employeeNumber: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.employee.count({ where }),
    ]);

    // Calculate lastActiveDate if not present - try to get from attendance/leave
    const enriched = await Promise.all(
      records.map(async (emp: any) => {
        let lastActive = emp.lastActiveDate;
        let lastSource = emp.lastActiveSource || null;

        // If not present and employee is archived, try to calculate from activities
        if (!lastActive && (emp.status === "INACTIVE" || emp.status === "TERMINATED" || emp.archivedAt)) {
          try {
            const lastAttendance = await prisma.attendanceRecord.findFirst({
              where: { employeeId: emp.id },
              orderBy: { workDate: "desc" },
              select: { workDate: true },
            });
            const lastLeave = await prisma.leaveRequest.findFirst({
              where: { employeeId: emp.id },
              orderBy: { endDate: "desc" },
              select: { endDate: true },
            });

            const dates: Date[] = [];
            if (lastAttendance?.workDate) dates.push(new Date(lastAttendance.workDate));
            if (lastLeave?.endDate) dates.push(new Date(lastLeave.endDate));
            if (emp.terminationDate) dates.push(new Date(emp.terminationDate));
            if (emp.archivedAt) dates.push(new Date(emp.archivedAt));

            if (dates.length > 0) {
              dates.sort((a, b) => b.getTime() - a.getTime());
              lastActive = dates[0];
              lastSource = lastAttendance ? "ATTENDANCE" : lastLeave ? "LEAVE" : "TERMINATION";
            }
          } catch {}
        }

        return {
          ...emp,
          lastActiveDate: lastActive,
          lastActiveSource: lastSource,
          fullName: `${emp.firstName} ${emp.lastName}`.trim(),
          departmentName: emp.department?.name || "",
          positionTitle: emp.position?.title || "",
          branchName: emp.branch?.name || "",
          managerName: emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}`.trim() : "",
          // For display
          lastActiveDateFormatted: lastActive ? new Date(lastActive).toISOString().slice(0, 10) : null,
          archivedAtFormatted: emp.archivedAt ? new Date(emp.archivedAt).toISOString().slice(0, 10) : null,
          terminationDateFormatted: emp.terminationDate ? new Date(emp.terminationDate).toISOString().slice(0, 10) : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      records: enriched,
      total,
      page,
      pageSize,
      pageCount: Math.max(Math.ceil(total / pageSize), 1),
      filters: { search, department, branch, sortBy, sortOrder },
    });
  } catch (error) {
    console.error("[archived employees] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
