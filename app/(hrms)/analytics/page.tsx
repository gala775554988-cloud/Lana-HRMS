import { Suspense } from "react";
import dynamic from "next/dynamic";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listHospitals } from "@/lib/enterprise/hospitals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, Calendar, Clock3, FileText, GitPullRequest, Hospital,
  TimerReset, Users, WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getRequestDictionary } from "@/lib/i18n-server";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LanaAnalytics } from "@/components/enterprise/lana-analytics";

const DashboardCharts = dynamic(() => import("@/components/hrms/dashboard-charts").then((mod) => mod.DashboardCharts), {
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" />,
});

async function getBranchStats() {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } });
  const branchIds = branches.map((branch) => branch.id);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [headcounts, pendingLeaves, attendanceToday] = await Promise.all([
    prisma.employee.groupBy({ by: ["branchId"], where: { branchId: { in: branchIds }, status: "ACTIVE" }, _count: { _all: true } }),
    prisma.leaveRequest.findMany({ where: { status: "PENDING", employee: { branchId: { in: branchIds } } }, select: { employee: { select: { branchId: true } } } }),
    prisma.attendanceRecord.findMany({ where: { workDate: { gte: todayStart }, employee: { branchId: { in: branchIds } } }, select: { employee: { select: { branchId: true } } } }),
  ]);

  const headcountMap = new Map(headcounts.map((row) => [row.branchId, row._count._all]));
  const pendingLeaveMap = new Map<string, number>();
  for (const row of pendingLeaves) { const id = row.employee?.branchId; if (id) pendingLeaveMap.set(id, (pendingLeaveMap.get(id) ?? 0) + 1); }
  const attendanceMap = new Map<string, number>();
  for (const row of attendanceToday) { const id = row.employee?.branchId; if (id) attendanceMap.set(id, (attendanceMap.get(id) ?? 0) + 1); }

  const stats = branches.map((branch) => ({
    ...branch,
    headcount: headcountMap.get(branch.id) ?? 0,
    pendingLeave: pendingLeaveMap.get(branch.id) ?? 0,
    attendanceToday: attendanceMap.get(branch.id) ?? 0,
  }));

  return stats.sort((a, b) => b.headcount - a.headcount);
}

async function getHospitalStats() {
  const hospitals = await prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } });
  const hospitalIds = hospitals.map((hospital) => hospital.id);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [headcounts, pendingLeaves, attendanceToday] = await Promise.all([
    prisma.employee.groupBy({ by: ["hospitalId"], where: { hospitalId: { in: hospitalIds }, status: "ACTIVE" }, _count: { _all: true } }),
    prisma.leaveRequest.findMany({ where: { status: "PENDING", employee: { hospitalId: { in: hospitalIds } } }, select: { employee: { select: { hospitalId: true } } } }),
    prisma.attendanceRecord.findMany({ where: { workDate: { gte: todayStart }, employee: { hospitalId: { in: hospitalIds } } }, select: { employee: { select: { hospitalId: true } } } }),
  ]);

  const headcountMap = new Map(headcounts.map((row) => [row.hospitalId, row._count._all]));
  const pendingLeaveMap = new Map<string, number>();
  for (const row of pendingLeaves) { const id = row.employee?.hospitalId; if (id) pendingLeaveMap.set(id, (pendingLeaveMap.get(id) ?? 0) + 1); }
  const attendanceMap = new Map<string, number>();
  for (const row of attendanceToday) { const id = row.employee?.hospitalId; if (id) attendanceMap.set(id, (attendanceMap.get(id) ?? 0) + 1); }

  const stats = hospitals.map((hospital) => ({
    ...hospital,
    headcount: headcountMap.get(hospital.id) ?? 0,
    pendingLeave: pendingLeaveMap.get(hospital.id) ?? 0,
    attendanceToday: attendanceMap.get(hospital.id) ?? 0,
  }));

  return stats.sort((a, b) => b.headcount - a.headcount);
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function lastNMonthRanges(n: number) {
  const now = new Date();
  const ranges: Array<{ start: Date; end: Date; label: string }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    ranges.push({ start, end, label: start.toISOString().slice(0, 7) });
  }
  return ranges;
}

export default async function AnalyticsPage() {
  const session = await auth();
  const roles = (session?.user?.roles as string[]) || [];
  const isAdmin = roles.some((role) =>
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER", "HR", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"].includes(role)
  );
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <section className="space-y-8">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">التحليلات</p>
        <h1 className="text-3xl font-semibold tracking-tight">نظرة عامة وتحليلات الفروع والمستشفيات</h1>
        <p className="mt-2 text-muted-foreground">مؤشرات الأداء الرئيسية، الاتجاهات الشهرية، وتوزيع الموظفين حسب الفرع والمستشفى.</p>
      </div>

      {isAdmin ? (
        <Suspense fallback={<OverviewSkeleton />}>
          <CompanyOverview locale={locale} dictionary={dictionary} showCharts />
        </Suspense>
      ) : null}

      <Suspense fallback={<BreakdownSkeleton />}>
        <BranchHospitalBreakdown />
      </Suspense>
    </section>
  );
}

async function BranchHospitalBreakdown() {
  const [branchStats, hospitalStats] = await Promise.all([getBranchStats(), getHospitalStats()]);
  const maxBranchHeadcount = Math.max(1, ...branchStats.map((b) => b.headcount));
  const maxHospitalHeadcount = Math.max(1, ...hospitalStats.map((h) => h.headcount));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>حسب الفرع</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {branchStats.map((branch) => (
            <div key={branch.id} className="space-y-2 rounded-xl border p-3">
              <BarRow label={`${branch.name} (${branch.code})`} value={branch.headcount} max={maxBranchHeadcount} />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>حضور اليوم: {branch.attendanceToday}</span>
                <span>إجازات معلقة: {branch.pendingLeave}</span>
              </div>
            </div>
          ))}
          {!branchStats.length && <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">لا توجد فروع نشطة.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>حسب المستشفى</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {hospitalStats.map((hospital) => (
            <div key={hospital.id} className="space-y-2 rounded-xl border p-3">
              <BarRow label={`${hospital.name} (${hospital.code})`} value={hospital.headcount} max={maxHospitalHeadcount} />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>حضور اليوم: {hospital.attendanceToday}</span>
                <span>إجازات معلقة: {hospital.pendingLeave}</span>
              </div>
            </div>
          ))}
          {!hospitalStats.length && <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">لا توجد مستشفيات مرتبطة بموظفين بعد.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

export async function CompanyOverview({ locale, dictionary, showCharts = true }: { locale: Locale; dictionary: Dictionary; showCharts?: boolean }) {
  const monthRanges = lastNMonthRanges(8);

  const [
    employees,
    departments,
    branches,
    hospitals,
    contracts,
    requestsToday,
    pendingApprovals,
    pendingLeave,
    attendanceToday,
    lateToday,
    payrollSum,
    overtimePending
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.branch.count({ where: { isActive: true } }),
    listHospitals().then(r => r.hospitals.length).catch(() => 0),
    prisma.employeeContract.count({ where: { status: "ACTIVE" } }),
    prisma.workflowInstance.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.workflowInstance.count({ where: { status: "PENDING" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.attendanceRecord.count({ where: { workDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.attendanceRecord.count({ where: { status: "LATE", workDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.payrollItem.aggregate({ _sum: { netPay: true }, where: { payrollRun: { status: "PAID" } } }).then(r => Number(r._sum.netPay || 0)),
    prisma.overtimeRequest.count({ where: { status: "PENDING" } })
  ]);

  const metrics = {
    employees, departments, branches, hospitals, contracts,
    requestsToday, pendingApprovals, pendingLeave, attendanceToday, lateToday,
    totalPayroll: payrollSum, overtimePending
  };

  // Month-by-month series only feeds the charts — skip the extra ~24 queries entirely when they won't render.
  let series: { months: string[]; employeeGrowth: number[]; requests: number[]; payroll: number[] } | null = null;
  if (showCharts) {
    const [employeeGrowthByMonth, requestsByMonth, payrollByMonth] = await Promise.all([
      Promise.all(monthRanges.map((range) => prisma.employee.count({ where: { hireDate: { lt: range.end } } }))),
      Promise.all(monthRanges.map((range) => prisma.workflowInstance.count({ where: { createdAt: { gte: range.start, lt: range.end } } }))),
      Promise.all(monthRanges.map((range) => prisma.payrollItem.aggregate({ _sum: { netPay: true }, where: { payrollRun: { status: "PAID", paidAt: { gte: range.start, lt: range.end } } } }).then((r) => Number(r._sum.netPay || 0))))
    ]);
    const monthLabels = monthRanges.map((r) => r.label);
    series = { months: monthLabels, employeeGrowth: employeeGrowthByMonth, requests: requestsByMonth, payroll: payrollByMonth };
  }

  const currencyLocale = { en: "en-US", ar: "ar-SA" } as const;
  const cards: Array<{ title: string; value: number | string; icon: LucideIcon; hint: string; tone: string; badgeText?: string }> = [
    { title: dictionary.dashboard.kpiActiveEmployees, value: employees, icon: Users, hint: dictionary.dashboard.kpiActiveEmployeesHint, tone: "from-indigo-600 to-purple-600", badgeText: dictionary.dashboard.kpiLiveBadge },
    { title: dictionary.dashboard.kpiDepartments, value: departments, icon: Building2, hint: dictionary.dashboard.kpiDepartmentsHint, tone: "from-blue-600 to-indigo-600" },
    { title: dictionary.dashboard.kpiBranches, value: branches, icon: Building2, hint: dictionary.dashboard.kpiBranchesHint, tone: "from-purple-600 to-pink-600" },
    { title: dictionary.dashboard.kpiHospitals, value: hospitals, icon: Hospital, hint: dictionary.dashboard.kpiHospitalsHint, tone: "from-emerald-600 to-teal-600", badgeText: dictionary.dashboard.kpiMedicalBadge },
    { title: dictionary.dashboard.kpiContracts, value: contracts, icon: FileText, hint: dictionary.dashboard.kpiContractsHint, tone: "from-cyan-600 to-blue-600" },
    { title: dictionary.dashboard.kpiRequestsToday, value: requestsToday, icon: GitPullRequest, hint: dictionary.dashboard.kpiRequestsTodayHint, tone: "from-violet-600 to-purple-600" },
    { title: dictionary.dashboard.kpiPendingApprovals, value: pendingApprovals, icon: Clock3, hint: dictionary.dashboard.kpiPendingApprovalsHint, tone: "from-amber-500 to-orange-600", badgeText: pendingApprovals > 0 ? dictionary.dashboard.kpiUrgentBadge : undefined },
    { title: dictionary.dashboard.kpiPendingLeave, value: pendingLeave, icon: Calendar, hint: dictionary.dashboard.kpiPendingLeaveHint, tone: "from-orange-500 to-red-600" },
    { title: dictionary.dashboard.kpiAttendanceToday, value: attendanceToday, icon: Clock3, hint: dictionary.dashboard.kpiAttendanceTodayHint, tone: "from-teal-600 to-emerald-600" },
    { title: dictionary.dashboard.kpiLateToday, value: lateToday, icon: TimerReset, hint: dictionary.dashboard.kpiLateTodayHint, tone: "from-rose-600 to-red-600" },
    { title: dictionary.dashboard.kpiTotalPayroll, value: new Intl.NumberFormat(currencyLocale[locale], { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(payrollSum), icon: WalletCards, hint: dictionary.dashboard.kpiTotalPayrollHint, tone: "from-indigo-700 to-slate-900" },
    { title: dictionary.dashboard.kpiOvertimePending, value: overtimePending, icon: TimerReset, hint: dictionary.dashboard.kpiOvertimePendingHint, tone: "from-fuchsia-600 to-purple-600" }
  ];

  return (
    <div className="space-y-8">
      <LanaAnalytics />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => <KpiCard key={card.title} {...card} index={index} />)}
      </div>
      {showCharts && series ? <DashboardCharts metrics={metrics} series={series} /> : null}
    </div>
  );
}

function KpiCard({
  title, value, icon: Icon, hint, tone, badgeText, index
}: {
  title: string; value: number | string; icon: LucideIcon; hint: string; tone: string; badgeText?: string; index: number;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none" style={{ animationDelay: `${index * 35}ms` }}>
      <CardContent className="relative p-6 lana-slide-up">
        <div className={`absolute -left-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25 pointer-events-none`} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{title}</p>
              {badgeText && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                  {badgeText}
                </span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">{value}</div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 truncate">{hint}</p>
          </div>
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-lg shadow-indigo-500/15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewSkeleton({ showCharts = true }: { showCharts?: boolean } = {}) {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-36 rounded-3xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
      {showCharts ? <div className="h-96 rounded-3xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" /> : null}
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-pulse">
      <div className="h-64 rounded-2xl border bg-muted" />
      <div className="h-64 rounded-2xl border bg-muted" />
    </div>
  );
}
