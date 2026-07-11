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

// Removed force-dynamic for better caching and performance

export default async function HrmsDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

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
          <h1 className="mb-2 text-2xl font-black text-slate-900 dark:text-slate-100">غير مصرح لك</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            هذه الصفحة مخصصة للمسؤولين فقط. أنت مسجل الدخول كموظف ولا تملك صلاحيات إدارة التنفيذيين.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/employee/dashboard"
              className="inline-block rounded-2xl bg-[#2E2A8C] px-6 py-3.5 font-bold text-white shadow-lg shadow-[#2E2A8C]/20 hover:bg-[#24206f] dark:bg-[#6D6AF8] dark:text-slate-950 dark:shadow-none transition-all"
            >
              الذهاب إلى بوابة الموظف الذاتية
            </a>
            <a href="/login" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
              تسجيل الدخول بحساب مسؤول آخر
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 lana-fade-in pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none md:p-10">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[#6D6AF8]/20 to-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-gradient-to-br from-[#2E2A8C]/15 to-indigo-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-[#6D6AF8]" />
              <span>Lana Executive Workspace 2.0</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
              لوحة تحكم Lana HRMS التنفيذية
            </h1>
            <p className="max-w-3xl text-sm sm:text-base leading-7 text-slate-600 dark:text-slate-400">
              مركز قيادة متكامل مدعوم بالذكاء الاصطناعي لمتابعة الموظفين، الإدارات، المستشفيات، الاعتمادات، الرواتب، وسجلات الحضور اللحظية في مؤسستك.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="font-extrabold text-slate-900 dark:text-slate-100">حالة النظام: نشط ومستقر</p>
                <p className="text-[11px] text-slate-400">تحديث فوري للبيانات</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const safe = async <T,>(fn: () => Promise<T>, fallback: T) => {
    try { return await fn(); } catch { return fallback; }
  };

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
    safe(() => prisma.employee.count({ where: { status: "ACTIVE" } }), 0),
    safe(() => prisma.department.count({ where: { isActive: true } }), 0),
    safe(() => prisma.branch.count({ where: { isActive: true } }), 0),
    safe(async () => (await listHospitals()).hospitals.length, 0),
    safe(() => prisma.employeeContract.count({ where: { status: "ACTIVE" } }), 0),
    safe(() => prisma.workflowInstance.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }), 0),
    safe(() => prisma.workflowInstance.count({ where: { status: "PENDING" } }), 0),
    safe(() => prisma.leaveRequest.count({ where: { status: "PENDING" } }), 0),
    safe(() => prisma.attendanceRecord.count({ where: { workDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }), 0),
    safe(() => prisma.attendanceRecord.count({ where: { status: "LATE", workDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }), 0),
    safe(async () => Number((await prisma.payrollItem.aggregate({ _sum: { netPay: true }, where: { payrollRun: { status: "PAID" } } }))._sum.netPay || 0), 0),
    safe(() => prisma.overtimeRequest.count({ where: { status: "PENDING" } }), 0)
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

  const cards: Array<{ title: string; value: number | string; icon: LucideIcon; hint: string; tone: string; badgeText?: string }> = [
    { title: "عدد الموظفين النشطين", value: employees, icon: Users, hint: "إجمالي القوى العاملة", tone: "from-indigo-600 to-purple-600", badgeText: "مباشر" },
    { title: "عدد الإدارات", value: departments, icon: Building2, hint: "إدارات وأقسام مسجلة", tone: "from-blue-600 to-indigo-600" },
    { title: "عدد الفروع", value: branches, icon: Building2, hint: "مكاتب ومقرات رئيسية", tone: "from-purple-600 to-pink-600" },
    { title: "المستشفيات والمراكز", value: hospitals, icon: Hospital, hint: "مواقع الرعاية الصحية", tone: "from-emerald-600 to-teal-600", badgeText: "طبي" },
    { title: "العقود الوظيفية", value: contracts, icon: FileText, hint: "عقود سارية المفعول", tone: "from-cyan-600 to-blue-600" },
    { title: "طلبات اليوم", value: requestsToday, icon: GitPullRequest, hint: "تم تقديمها خلال 24 ساعة", tone: "from-violet-600 to-purple-600" },
    { title: "بانتظار الاعتماد", value: pendingApprovals, icon: Clock3, hint: "دورة سير العمل (Workflow)", tone: "from-amber-500 to-orange-600", badgeText: pendingApprovals > 0 ? "عاجل" : undefined },
    { title: "طلبات الإجازة المعلقة", value: pendingLeave, icon: Calendar, hint: "تنتظر مراجعة المدير", tone: "from-orange-500 to-red-600" },
    { title: "حضور اليوم السريع", value: attendanceToday, icon: Clock3, hint: "سجلات تسجيل الدخول", tone: "from-teal-600 to-emerald-600" },
    { title: "حالات التأخير اليوم", value: lateToday, icon: TimerReset, hint: "تجاوز وقت الحضور الرسمي", tone: "from-rose-600 to-red-600" },
    { title: "إجمالي الرواتب المدفوعة", value: new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(payrollSum), icon: WalletCards, hint: "مسيرات الرواتب المعتمدة", tone: "from-indigo-700 to-slate-900" },
    { title: "طلبات الأوفر تايم", value: overtimePending, icon: TimerReset, hint: "بانتظار موافقة الموارد البشرية", tone: "from-fuchsia-600 to-purple-600" }
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
            <TrendingUp className="h-5 w-5 text-[#6D6AF8]" />
            <span>الوصول السريع للوحدات الرئيسية</span>
          </h2>
        </div>
        
        <div className="grid gap-5 md:grid-cols-3">
          <QuickLinkCard
            title="إدارة الموظفين والوثائق"
            href="/employees"
            description="عرض قائمة الموظفين، إضافة موظف جديد، مراجعة العقود والوثائق الرسمية للموظف."
            icon={Users}
            tone="from-blue-500 to-indigo-600"
          />
          <QuickLinkCard
            title="صندوق الاعتمادات وسير العمل"
            href="/request-center"
            description="متابعة طلبات الموظفين المعلقة مثل الإجازات، السلف، المصاريف، والأوفر تايم."
            icon={GitPullRequest}
            tone="from-purple-500 to-pink-600"
          />
          <QuickLinkCard
            title="ذكاء الأعمال والتقارير الشاملة"
            href="/reports"
            description="تصدير وتحليل بيانات القوى العاملة، مؤشرات الأداء، وتقارير الرواتب والميزانيات."
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
