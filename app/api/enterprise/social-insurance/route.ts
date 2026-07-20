import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import type { Prisma, SocialInsuranceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function canView(roles: string[], permissions: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "social-insurance" }, roles);
}

const employeeSelect = {
  id: true,
  employeeNumber: true,
  nationalId: true,
  firstName: true,
  lastName: true,
  department: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  nationality: { select: { id: true, name: true } },
  status: true
} satisfies Prisma.EmployeeSelect;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  if (!canView(roles, permissions)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  if (!isEnterpriseResourceAllowed(roles, "social-insurance")) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const branchId = params.get("branchId");
  const departmentId = params.get("departmentId");
  const nationalityId = params.get("nationalityId");
  const search = params.get("search")?.trim();
  const page = Math.max(1, Number(params.get("page")) || 1);

  const employeeWhere: Prisma.EmployeeWhereInput = {
    status: "ACTIVE",
    ...(branchId ? { branchId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(nationalityId ? { nationalityId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeNumber: { contains: search, mode: "insensitive" } },
            { nationalId: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const recordWhere: Prisma.SocialInsuranceRecordWhereInput = {
    employee: employeeWhere,
    ...(status ? { status: status as SocialInsuranceStatus } : {})
  };

  // "NOT_REGISTERED" has no guaranteed row -- employees with no record at
  // all are also, correctly, not registered. Handle that filter separately
  // by listing employees missing a record instead of querying the table.
  if (status === "NOT_REGISTERED") {
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where: { ...employeeWhere, socialInsuranceRecord: null },
        select: employeeSelect,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE
      }),
      prisma.employee.count({ where: { ...employeeWhere, socialInsuranceRecord: null } })
    ]);
    return NextResponse.json({
      success: true,
      records: employees.map((employee) => ({ employee, record: null })),
      total,
      page,
      pageSize: PAGE_SIZE
    });
  }

  const [records, total] = await Promise.all([
    prisma.socialInsuranceRecord.findMany({
      where: recordWhere,
      include: { employee: { select: employeeSelect } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.socialInsuranceRecord.count({ where: recordWhere })
  ]);

  return NextResponse.json({
    success: true,
    records: records.map((record) => ({ employee: record.employee, record })),
    total,
    page,
    pageSize: PAGE_SIZE
  });
}
