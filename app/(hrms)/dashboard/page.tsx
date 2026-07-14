import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardCharts } from "@/components/hrms/dashboard-charts";
import { listHospitals } from "@/lib/enterprise/hospitals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Calendar, Clock3, FileText, GitPullRequest, Hospital,
  TimerReset, Users, WalletCards, Sparkles, ArrowUpRight, ShieldCheck,
  TrendingUp, Activity
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getRequestDictionary } from "@/lib/i18n-server";
import type { Dictionary, Locale } from "@/lib/i18n";

// Removed force-dynamic for better caching and performance

export default async function HrmsDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { locale, dictionary } = await getRequestDictionary();

  const roles = (session.user.roles as string[]) || [];
  const isAdmin = roles.some((role: string) =>
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER", "HR", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"].includes(role)
  );

  if (!isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 text-3xl">
            🔒
          </div>
          <h1 className="mb-2 text-2xl font-black text-slate-900 dark:text-slate-100">{dictionary.dashboard.unauthorizedTitle}</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {dictionary.dashboard.unauthorizedMessage}
          </p>
          <a href="/employee/dashboard" className="inline-block rounded-2xl bg-primary px-6 py-3.5 font-bold text-white">
            {dictionary.dashboard.goToEmployeePortal}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-10">
        <div className="relative">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
            {dictionary.dashboard.heroTitle}
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
            {dictionary.dashboard.heroDescription}
          </p>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent locale={locale} dictionary={dictionary} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  // Optimized: Parallel queries with select where possible
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
    totalPayroll: payrollSum,
    overtimePending
  };

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
      {/* KPI Grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => <KpiCard key={card.title} {...card} index={index} />)}
      </div>

      {/* Charts Section */}
      <DashboardCharts metrics={metrics} />

      {/* Quick Access Modules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>{dictionary.dashboard.quickAccessTitle}</span>
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <QuickLinkCard
            title={dictionary.dashboard.quickLinkEmployeesTitle}
            href="/employees"
            description={dictionary.dashboard.quickLinkEmployeesDesc}
            icon={Users}
            tone="from-blue-500 to-indigo-600"
          />
          <QuickLinkCard
            title={dictionary.dashboard.quickLinkRequestsTitle}
            href="/request-center"
            description={dictionary.dashboard.quickLinkRequestsDesc}
            icon={GitPullRequest}
            tone="from-purple-500 to-pink-600"
          />
          <QuickLinkCard
            title={dictionary.dashboard.quickLinkReportsTitle}
            href="/reports"
            description={dictionary.dashboard.quickLinkReportsDesc}
            icon={Activity}
            tone="from-emerald-500 to-teal-600"
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
  tone,
  badgeText,
  index
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  hint: string;
  tone: string;
  badgeText?: string;
  index: number;
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
            
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {value}
            </div>
            
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

function QuickLinkCard({
  title,
  href,
  description,
  icon: Icon,
  tone
}: {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <a href={href} className="group block h-full">
      <Card className="h-full rounded-3xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <CardHeader className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-800 dark:group-hover:bg-indigo-950/60 dark:group-hover:text-indigo-400 transition-colors">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <CardTitle className="text-lg font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {title}
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-600 dark:text-slate-400 mt-2">
            {description}
          </CardDescription>
        </CardHeader>
      </Card>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-36 rounded-3xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
      <div className="h-96 rounded-3xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}
