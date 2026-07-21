import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewPayroll } from "@/lib/enterprise/payroll-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Payroll Dashboard summary: run counts by status, gross/net totals for the
 * most recent run, KPIs (headcount, average net, overtime/deduction totals
 * this period), a settled-run cost trend for the last few periods, missing-
 * data detection (active employees with no contract / no salary amount, so
 * payroll can't compute them), upcoming payroll periods, recent run activity
 * from the existing AuditLog, and a department/branch cost breakdown of the
 * most recent run. Every number here is a direct aggregate query against
 * tables the payroll engine already reads/writes -- nothing new is stored
 * just for this dashboard. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewPayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const now = new Date();

  const [statusGroups, missingContracts, missingSalaryAmount, activeEmployeeCount, upcomingPeriods, recentActivityRaw, latestRun, settledRuns] = await Promise.all([
    prisma.payrollRun.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.employee.count({ where: { status: "ACTIVE", contracts: { none: {} } } }),
    prisma.employee.count({
      where: {
        status: "ACTIVE",
        contracts: { none: { status: "ACTIVE", salaryAmount: { gt: 0 } } }
      }
    }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.payrollPeriod.findMany({
      where: { status: "OPEN", endDate: { gte: now } },
      orderBy: { startDate: "asc" },
      take: 5,
      select: { id: true, name: true, startDate: true, endDate: true, status: true }
    }),
    prisma.auditLog.findMany({
      where: { entity: "payrollRun" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, entityId: true, metadata: true, createdAt: true, actor: { select: { name: true } } }
    }),
    prisma.payrollRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, period: true, status: true }
    }),
    prisma.payrollRun.findMany({
      where: { status: { in: ["PAID", "LOCKED", "ARCHIVED"] } },
      orderBy: { periodStartDate: "desc" },
      take: 6,
      select: { id: true, period: true, periodStartDate: true }
    })
  ]);

  const statusCounts: Record<string, number> = { DRAFT: 0, PROCESSING: 0, APPROVED: 0, PAID: 0, CANCELLED: 0, LOCKED: 0, ARCHIVED: 0 };
  for (const group of statusGroups) statusCounts[group.status] = group._count._all;

  let departmentCost: Array<{ name: string; gross: number; net: number; employeeCount: number }> = [];
  let branchCost: Array<{ name: string; gross: number; net: number; employeeCount: number }> = [];
  let latestRunTotals = { gross: 0, net: 0, employeeCount: 0, overtimeTotal: 0, deductionTotal: 0 };

  if (latestRun) {
    const items = await prisma.payrollItem.findMany({
      where: { payrollRunId: latestRun.id },
      select: {
        grossPay: true,
        netPay: true,
        overtimeTotal: true,
        deductionTotal: true,
        employee: { select: { department: { select: { name: true } }, branch: { select: { name: true } } } }
      }
    });

    const byDept = new Map<string, { gross: number; net: number; employeeCount: number }>();
    const byBranch = new Map<string, { gross: number; net: number; employeeCount: number }>();
    for (const item of items) {
      const gross = Number(item.grossPay);
      const net = Number(item.netPay);
      latestRunTotals.gross += gross;
      latestRunTotals.net += net;
      latestRunTotals.employeeCount += 1;
      latestRunTotals.overtimeTotal += Number(item.overtimeTotal);
      latestRunTotals.deductionTotal += Number(item.deductionTotal);

      const deptName = item.employee?.department?.name ?? "بدون قسم";
      const dept = byDept.get(deptName) ?? { gross: 0, net: 0, employeeCount: 0 };
      dept.gross += gross;
      dept.net += net;
      dept.employeeCount += 1;
      byDept.set(deptName, dept);

      const branchName = item.employee?.branch?.name ?? "بدون فرع";
      const branch = byBranch.get(branchName) ?? { gross: 0, net: 0, employeeCount: 0 };
      branch.gross += gross;
      branch.net += net;
      branch.employeeCount += 1;
      byBranch.set(branchName, branch);
    }

    departmentCost = Array.from(byDept.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.gross - a.gross);
    branchCost = Array.from(byBranch.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.gross - a.gross);
  }

  const costTrend = await Promise.all(
    [...settledRuns].reverse().map(async (run) => {
      const agg = await prisma.payrollItem.aggregate({
        where: { payrollRunId: run.id },
        _sum: { grossPay: true, netPay: true }
      });
      return { period: run.period, gross: Number(agg._sum.grossPay ?? 0), net: Number(agg._sum.netPay ?? 0) };
    })
  );

  const kpis = {
    activeEmployeeCount,
    avgNetPerEmployee: latestRunTotals.employeeCount > 0 ? Math.round(latestRunTotals.net / latestRunTotals.employeeCount) : 0,
    overtimeTotal: latestRunTotals.overtimeTotal,
    deductionTotal: latestRunTotals.deductionTotal
  };

  const recentActivity = recentActivityRaw.map((log) => ({
    id: log.id,
    action: log.action,
    runId: log.entityId,
    actorName: log.actor?.name ?? "النظام",
    createdAt: log.createdAt,
    metadata: log.metadata
  }));

  return NextResponse.json({
    success: true,
    statusCounts,
    latestRun: latestRun ? { ...latestRun, totals: latestRunTotals } : null,
    kpis,
    costTrend,
    departmentCost,
    branchCost,
    missingData: { missingContracts, missingSalaryAmount },
    upcomingPeriods,
    recentActivity
  });
}
