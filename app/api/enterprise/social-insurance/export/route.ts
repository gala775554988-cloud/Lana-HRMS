import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ReportKind = "registered" | "unregistered" | "excluded" | "new" | "salary-adjustments";

const REPORT_TITLES: Record<ReportKind, string> = {
  registered: "الموظفون المسجلون في التأمينات الاجتماعية",
  unregistered: "الموظفون غير المسجلين في التأمينات الاجتماعية",
  excluded: "الموظفون المستبعدون من التأمينات الاجتماعية",
  new: "التسجيلات الجديدة",
  "salary-adjustments": "تعديلات الأجر الخاضع للاشتراك"
};

function employeeWhere(params: URLSearchParams): Prisma.EmployeeWhereInput {
  const branchId = params.get("branchId");
  const departmentId = params.get("departmentId");
  const nationalityId = params.get("nationalityId");
  return {
    status: "ACTIVE",
    ...(branchId ? { branchId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(nationalityId ? { nationalityId } : {})
  };
}

function dateRange(params: URLSearchParams) {
  const from = params.get("from") ? new Date(params.get("from")!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = params.get("to") ? new Date(params.get("to")!) : new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function buildRows(report: ReportKind, params: URLSearchParams) {
  const empWhere = employeeWhere(params);
  const employeeInclude = {
    select: {
      employeeNumber: true,
      nationalId: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      branch: { select: { name: true } },
      nationality: { select: { name: true } }
    }
  } as const;

  if (report === "unregistered") {
    const employees = await prisma.employee.findMany({
      where: { ...empWhere, socialInsuranceRecord: null },
      select: employeeInclude.select,
      orderBy: [{ firstName: "asc" }]
    });
    return employees.map((e) => ({
      "الرقم الوظيفي": e.employeeNumber,
      "الاسم": `${e.firstName} ${e.lastName}`,
      "رقم الهوية": e.nationalId,
      "الإدارة": e.department?.name ?? "",
      "الفرع": e.branch?.name ?? "",
      "الجنسية": e.nationality?.name ?? ""
    }));
  }

  if (report === "new") {
    const { from, to } = dateRange(params);
    const movements = await prisma.socialInsuranceMovement.findMany({
      where: { type: "REGISTERED", createdAt: { gte: from, lte: to }, record: { employee: empWhere } },
      include: { record: { include: { employee: { select: employeeInclude.select } } } },
      orderBy: { createdAt: "desc" }
    });
    return movements.map((m) => ({
      "الرقم الوظيفي": m.record.employee.employeeNumber,
      "الاسم": `${m.record.employee.firstName} ${m.record.employee.lastName}`,
      "الإدارة": m.record.employee.department?.name ?? "",
      "الفرع": m.record.employee.branch?.name ?? "",
      "رقم المشترك": m.record.subscriberNumber ?? "",
      "تاريخ التسجيل": m.createdAt.toISOString().slice(0, 10)
    }));
  }

  if (report === "salary-adjustments") {
    const { from, to } = dateRange(params);
    const movements = await prisma.socialInsuranceMovement.findMany({
      where: { type: "WAGE_ADJUSTED", createdAt: { gte: from, lte: to }, record: { employee: empWhere } },
      include: { record: { include: { employee: { select: employeeInclude.select } } } },
      orderBy: { createdAt: "desc" }
    });
    return movements.map((m) => ({
      "الرقم الوظيفي": m.record.employee.employeeNumber,
      "الاسم": `${m.record.employee.firstName} ${m.record.employee.lastName}`,
      "الإدارة": m.record.employee.department?.name ?? "",
      "الوصف": m.description,
      "المصدر": m.source,
      "التاريخ": m.createdAt.toISOString().slice(0, 10)
    }));
  }

  // registered / excluded
  const status = report === "excluded" ? ["EXCLUDED" as const] : (["ACTIVE", "SUSPENDED", "EXCLUDED"] as const);
  const records = await prisma.socialInsuranceRecord.findMany({
    where: { status: { in: status as any }, employee: empWhere },
    include: { employee: { select: employeeInclude.select } },
    orderBy: { updatedAt: "desc" }
  });
  return records.map((r) => ({
    "الرقم الوظيفي": r.employee.employeeNumber,
    "الاسم": `${r.employee.firstName} ${r.employee.lastName}`,
    "الإدارة": r.employee.department?.name ?? "",
    "الفرع": r.employee.branch?.name ?? "",
    "الجنسية": r.employee.nationality?.name ?? "",
    "الحالة": r.status,
    "رقم المشترك": r.subscriberNumber ?? "",
    "تاريخ التسجيل": r.registrationDate ? r.registrationDate.toISOString().slice(0, 10) : "",
    "الأجر الخاضع": Number(r.subjectWage),
    "مساهمة الموظف": Number(r.employeeContributionAmount),
    "مساهمة الجهة": Number(r.employerContributionAmount)
  }));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const allowed = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "social-insurance" }, roles);
  if (!allowed || !isEnterpriseResourceAllowed(roles, "social-insurance")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const report = (params.get("report") || "registered") as ReportKind;
  if (!REPORT_TITLES[report]) return NextResponse.json({ success: false, message: "Unknown report" }, { status: 400 });

  const rows = await buildRows(report, params);
  const format = (params.get("format") || "xlsx").toLowerCase();

  if (format === "json") {
    return NextResponse.json({ success: true, title: REPORT_TITLES[report], rows });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="social-insurance-${report}.xlsx"`
    }
  });
}
