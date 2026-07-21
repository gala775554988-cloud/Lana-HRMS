import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewLeave } from "@/lib/enterprise/leave-permissions";
import { getAbsentEmployees, getAllLeaveTypeBalances } from "@/lib/enterprise/leave-engine";

export const dynamic = "force-dynamic";

type ReportKind = "register" | "by-type" | "by-department" | "absentee" | "balances";

const REPORT_TITLES: Record<ReportKind, string> = {
  register: "سجل طلبات الإجازات",
  "by-type": "الإجازات حسب النوع",
  "by-department": "الإجازات حسب القسم",
  absentee: "كشف الموظفين الغائبين بإجازة",
  balances: "أرصدة الإجازات لكل موظف"
};

const employeeSelect = {
  employeeNumber: true,
  firstName: true,
  lastName: true,
  department: { select: { name: true } },
  branch: { select: { name: true } }
} as const;

async function buildRows(report: ReportKind, params: URLSearchParams) {
  if (report === "register") {
    const status = params.get("status") || undefined;
    const requests = await prisma.leaveRequest.findMany({
      where: status ? { status: status as any } : {},
      include: { employee: { select: employeeSelect }, leaveType: { select: { name: true } } },
      orderBy: { startDate: "desc" },
      take: 2000
    });
    return requests.map((r) => ({
      "الرقم الوظيفي": r.employee.employeeNumber,
      "الاسم": `${r.employee.firstName} ${r.employee.lastName}`,
      "القسم": r.employee.department?.name ?? "",
      "الفرع": r.employee.branch?.name ?? "",
      "نوع الإجازة": r.leaveType.name,
      "من": r.startDate.toISOString().slice(0, 10),
      "إلى": r.endDate.toISOString().slice(0, 10),
      "الأيام": Number(r.days),
      "الحالة": r.status,
      "السبب": r.reason ?? ""
    }));
  }

  if (report === "by-type") {
    const requests = await prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: { status: { in: ["APPROVED", "PENDING"] } },
      _count: { _all: true },
      _sum: { days: true }
    });
    const types = await prisma.leaveType.findMany({ select: { id: true, name: true } });
    const byId = new Map(types.map((t) => [t.id, t.name]));
    return requests.map((r) => ({
      "نوع الإجازة": byId.get(r.leaveTypeId) ?? "غير معروف",
      "عدد الطلبات": r._count._all,
      "إجمالي الأيام": Number(r._sum.days ?? 0)
    }));
  }

  if (report === "by-department") {
    const requests = await prisma.leaveRequest.findMany({
      where: { status: { in: ["APPROVED", "PENDING"] } },
      include: { employee: { select: { department: { select: { name: true } } } } }
    });
    const groups = new Map<string, { count: number; days: number }>();
    for (const r of requests) {
      const key = r.employee.department?.name ?? "بدون قسم";
      const acc = groups.get(key) ?? { count: 0, days: 0 };
      acc.count += 1;
      acc.days += Number(r.days);
      groups.set(key, acc);
    }
    return Array.from(groups.entries()).map(([name, acc]) => ({
      "القسم": name,
      "عدد الطلبات": acc.count,
      "إجمالي الأيام": Number(acc.days.toFixed(2))
    }));
  }

  if (report === "absentee") {
    const dateParam = params.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();
    const absentees = await getAbsentEmployees(date);
    return absentees.map((a) => ({
      "الرقم الوظيفي": a.employee.employeeNumber,
      "الاسم": `${a.employee.firstName} ${a.employee.lastName}`,
      "القسم": a.employee.department?.name ?? "",
      "الفرع": a.employee.branch?.name ?? "",
      "نوع الإجازة": a.leaveType.name,
      "من": a.startDate.toISOString().slice(0, 10),
      "إلى": a.endDate.toISOString().slice(0, 10)
    }));
  }

  // balances
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true },
    take: 2000
  });
  const rows: Record<string, unknown>[] = [];
  for (const employee of employees) {
    const balances = await getAllLeaveTypeBalances(employee.id);
    for (const balance of balances) {
      rows.push({
        "الرقم الوظيفي": employee.employeeNumber,
        "الاسم": `${employee.firstName} ${employee.lastName}`,
        "نوع الإجازة": balance.leaveTypeName,
        "الرصيد المستحق": balance.accrued,
        "المرحّل من العام السابق": balance.carriedOver,
        "المستخدم": balance.used,
        "المتبقي": balance.remaining
      });
    }
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewLeave(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const report = (params.get("report") || "register") as ReportKind;
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
      "Content-Disposition": `attachment; filename="leave-${report}.xlsx"`
    }
  });
}
