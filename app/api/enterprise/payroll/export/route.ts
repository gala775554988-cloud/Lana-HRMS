import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type ReportKind = "register" | "summary" | "by-department" | "by-branch" | "allowances" | "deductions" | "loans";

const REPORT_TITLES: Record<ReportKind, string> = {
  register: "سجل الرواتب (Payroll Register)",
  summary: "ملخص الرواتب (Payroll Summary)",
  "by-department": "الرواتب حسب القسم",
  "by-branch": "الرواتب حسب الفرع",
  allowances: "تقرير البدلات",
  deductions: "تقرير الاستقطاعات",
  loans: "تقرير السلف والقروض"
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
    const runId = params.get("runId");
    const items = await prisma.payrollItem.findMany({
      where: runId ? { payrollRunId: runId } : {},
      include: { employee: { select: employeeSelect }, payrollRun: { select: { name: true, period: true } } },
      orderBy: { netPay: "desc" }
    });
    return items.map((i) => ({
      "الرقم الوظيفي": i.employee.employeeNumber,
      "الاسم": `${i.employee.firstName} ${i.employee.lastName}`,
      "القسم": i.employee.department?.name ?? "",
      "الفرع": i.employee.branch?.name ?? "",
      "الفترة": i.payrollRun.period,
      "الراتب الأساسي": Number(i.baseSalary),
      "البدلات": Number(i.allowanceTotal),
      "المكافآت": Number(i.bonusTotal),
      "الإضافي": Number(i.overtimeTotal),
      "الإجمالي": Number(i.grossPay),
      "التأمينات": Number(i.insuranceDeduction),
      "الضرائب": Number(i.taxTotal),
      "القروض": Number(i.loanDeduction),
      "السلف": Number(i.advanceDeduction),
      "الغياب": Number(i.absenceDeduction),
      "التأخير": Number(i.lateDeduction),
      "الجزاءات": Number(i.penaltyDeduction),
      "إجمالي الاستقطاعات": Number(i.deductionTotal),
      "الصافي": Number(i.netPay),
      "العملة": i.currency
    }));
  }

  if (report === "summary") {
    const period = params.get("period");
    const items = await prisma.payrollItem.findMany({
      where: period ? { payrollRun: { period } } : {},
      select: { grossPay: true, deductionTotal: true, netPay: true, allowanceTotal: true, overtimeTotal: true, bonusTotal: true, payrollRun: { select: { period: true, name: true, status: true } } }
    });
    const byPeriod = new Map<string, { count: number; gross: number; deductions: number; net: number }>();
    for (const item of items) {
      const key = item.payrollRun.period;
      const acc = byPeriod.get(key) ?? { count: 0, gross: 0, deductions: 0, net: 0 };
      acc.count += 1;
      acc.gross += Number(item.grossPay);
      acc.deductions += Number(item.deductionTotal);
      acc.net += Number(item.netPay);
      byPeriod.set(key, acc);
    }
    return Array.from(byPeriod.entries()).map(([period, acc]) => ({
      "الفترة": period,
      "عدد الموظفين": acc.count,
      "إجمالي الرواتب": Number(acc.gross.toFixed(2)),
      "إجمالي الاستقطاعات": Number(acc.deductions.toFixed(2)),
      "صافي الرواتب": Number(acc.net.toFixed(2))
    }));
  }

  if (report === "by-department" || report === "by-branch") {
    const period = params.get("period");
    const items = await prisma.payrollItem.findMany({
      where: period ? { payrollRun: { period } } : {},
      include: { employee: { select: employeeSelect } }
    });
    const groups = new Map<string, { count: number; gross: number; net: number }>();
    for (const item of items) {
      const key = report === "by-department" ? (item.employee.department?.name ?? "بدون قسم") : (item.employee.branch?.name ?? "بدون فرع");
      const acc = groups.get(key) ?? { count: 0, gross: 0, net: 0 };
      acc.count += 1;
      acc.gross += Number(item.grossPay);
      acc.net += Number(item.netPay);
      groups.set(key, acc);
    }
    const label = report === "by-department" ? "القسم" : "الفرع";
    return Array.from(groups.entries()).map(([name, acc]) => ({
      [label]: name,
      "عدد الموظفين": acc.count,
      "إجمالي الرواتب": Number(acc.gross.toFixed(2)),
      "صافي الرواتب": Number(acc.net.toFixed(2))
    }));
  }

  if (report === "allowances" || report === "deductions") {
    const delegate = report === "allowances" ? prisma.allowance : prisma.deduction;
    const rows = await (delegate as typeof prisma.allowance).findMany({
      where: { effectiveTo: null },
      include: { employee: { select: employeeSelect } },
      orderBy: { amount: "desc" },
      take: 500
    });
    return rows.map((r) => ({
      "الرقم الوظيفي": r.employee.employeeNumber,
      "الاسم": `${r.employee.firstName} ${r.employee.lastName}`,
      "البند": r.name,
      "التصنيف": r.category,
      "المبلغ": Number(r.amount),
      "العملة": r.currency,
      "متكرر": r.isRecurring ? "نعم" : "لا",
      "المصدر": r.source
    }));
  }

  // loans
  const [loans, advances] = await Promise.all([
    prisma.loan.findMany({ where: { status: "ACTIVE" }, include: { employee: { select: employeeSelect } } }),
    prisma.employeeSalaryAdvance.findMany({ where: { status: "APPROVED" }, include: { employee: { select: employeeSelect } } })
  ]);
  return [
    ...loans.map((l) => ({
      "النوع": "قرض",
      "الرقم الوظيفي": l.employee.employeeNumber,
      "الاسم": `${l.employee.firstName} ${l.employee.lastName}`,
      "المبلغ الأصلي": Number(l.principalAmount),
      "المتبقي": Number(l.outstandingAmount),
      "القسط الشهري": Number(l.installmentAmount),
      "الحالة": l.status
    })),
    ...advances.map((a) => ({
      "النوع": "سلفة",
      "الرقم الوظيفي": a.employee.employeeNumber,
      "الاسم": `${a.employee.firstName} ${a.employee.lastName}`,
      "المبلغ الأصلي": Number(a.amount),
      "المتبقي": Number(a.amount) - Number(a.monthlyDeduction) * a.paidInstallments,
      "القسط الشهري": Number(a.monthlyDeduction),
      "الحالة": a.status
    }))
  ];
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const allowed = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || roles.includes("PAYROLL_OFFICER") || hasPermission(permissions, { action: "read", resource: "payroll" });
  if (!allowed) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

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
      "Content-Disposition": `attachment; filename="payroll-${report}.xlsx"`
    }
  });
}
