import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardCharts } from "@/components/hrms/dashboard-charts";
import { listHospitals } from "@/lib/enterprise/hospitals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Clock3, FileText, GitPullRequest, Hospital, TimerReset, Users, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrmsDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  const isAdmin = roles.some((role: string) =>
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
  );

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F5F7FB]">
        <div className="max-w-md rounded-3xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xl shadow-[#2E2A8C]/10">
          <div className="mb-4 text-6xl">🔒</div>
          <h1 className="mb-2 text-2xl font-black text-[#111827]">غير مصرح لك</h1>
          <p className="mb-6 text-[#6B7280]">هذه الصفحة مخصصة للمسؤولين فقط. أنت مسجل الدخول كموظف.</p>
          <div className="flex flex-col gap-3">
            <a href="/employee/dashboard" className="inline-block rounded-2xl bg-[#2E2A8C] px-6 py-3 font-bold text-white shadow-lg shadow-[#2E2A8C]/20 hover:bg-[#24206f]">الذهاب إلى بوابة الموظف</a>
            <a href="/login" className="text-sm text-[#6B7280] hover:underline">تسجيل الدخول بحساب مسؤول</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 lana-fade-in">
      <div className="relative overflow-hidden rounded-[2rem] border border-[#E5E7EB] bg-white p-6 shadow-sm shadow-slate-200/70 md:p-8">
        <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[#6D6AF8]/15 blur-3xl" />
        <div className="absolute -bottom-28 right-10 h-56 w-56 rounded-full bg-[#2E2A8C]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 border-[#2E2A8C]/10 bg-[#2E2A8C]/10 text-[#2E2A8C] hover:bg-[#2E2A8C]/10">Lana Executive Workspace</Badge>
            <h1 className="text-4xl font-black tracking-tight text-[#111827] md:text-5xl">لوحة تحكم Lana HRMS</h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[#6B7280]">مركز قيادة تنفيذي لمتابعة الموظفين، الإدارات، الفروع، المستشفيات، العقود، الطلبات، الحضور، الرواتب، والأوفر تايم.</p>
          </div>
          <div className="rounded-3xl border border-[#E5E7EB] bg-[#F5F7FB] px-5 py-4 text-sm text-[#6B7280]">
            <p className="font-bold text-[#2E2A8C]">Build 2026.07</p>
            <p>Powered by Lana Medical</p>
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

  const metrics = { employees, departments, branches, hospitals, contracts, requestsToday, pendingApprovals, pendingLeave, attendanceToday, lateToday, totalPayroll: payrollSum, overtimePending };

  const cards: Array<{ title: string; value: number | string; icon: LucideIcon; hint: string; tone: string }> = [
    { title: "عدد الموظفين", value: employees, icon: Users, hint: "الموظفون النشطون", tone: "from-[#2E2A8C] to-[#6D6AF8]" },
    { title: "عدد الإدارات", value: departments, icon: Building2, hint: "إدارات فعالة", tone: "from-[#4B46C6] to-[#6D6AF8]" },
    { title: "عدد الفروع", value: branches, icon: Building2, hint: "فروع فعالة", tone: "from-[#2E2A8C] to-[#4B46C6]" },
    { title: "عدد المستشفيات", value: hospitals, icon: Hospital, hint: "مواقع رعاية", tone: "from-[#22C55E] to-[#6D6AF8]" },
    { title: "عدد العقود", value: contracts, icon: FileText, hint: "عقود نشطة", tone: "from-[#4B46C6] to-[#2E2A8C]" },
    { title: "طلبات اليوم", value: requestsToday, icon: GitPullRequest, hint: "تم إنشاؤها اليوم", tone: "from-[#6D6AF8] to-[#2E2A8C]" },
    { title: "بانتظار الاعتماد", value: pendingApprovals, icon: Clock3, hint: "Workflow pending", tone: "from-[#F59E0B] to-[#6D6AF8]" },
    { title: "الإجازات", value: pendingLeave, icon: Calendar, hint: "طلبات معلقة", tone: "from-[#F59E0B] to-[#4B46C6]" },
    { title: "الحضور اليوم", value: attendanceToday, icon: Clock3, hint: "سجلات اليوم", tone: "from-[#22C55E] to-[#2E2A8C]" },
    { title: "التأخير", value: lateToday, icon: TimerReset, hint: "حالات متأخرة", tone: "from-[#EF4444] to-[#F59E0B]" },
    { title: "الرواتب", value: new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(payrollSum), icon: WalletCards, hint: "إجمالي مدفوع", tone: "from-[#2E2A8C] to-[#4B46C6]" },
    { title: "الأوفر تايم", value: overtimePending, icon: TimerReset, hint: "بانتظار HR", tone: "from-[#6D6AF8] to-[#EF4444]" }
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => <KpiCard key={card.title} {...card} index={index} />)}
      </div>
      <DashboardCharts metrics={metrics} />
      <div className="grid gap-4 md:grid-cols-3">
        <QuickLinkCard title="الموظفون" href="/employees" description="إدارة الملفات والوثائق والهيكل" />
        <QuickLinkCard title="استقبال الطلبات" href="/request-center" description="متابعة الاعتمادات وسير العمل" />
        <QuickLinkCard title="التقارير" href="/reports" description="تحليلات وتصدير بيانات HR" />
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, hint, tone, index }: { title: string; value: number | string; icon: LucideIcon; hint: string; tone: string; index: number }) {
  return (
    <Card className="group overflow-hidden rounded-3xl border-[#E5E7EB] bg-white shadow-sm shadow-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:border-[#6D6AF8]/40 hover:shadow-xl hover:shadow-[#2E2A8C]/10" title={hint} style={{ animationDelay: `${index * 45}ms` }}>
      <CardContent className="relative p-5 lana-slide-up">
        <div className={`absolute -left-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${tone} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#6B7280]">{title}</p>
            <div className="mt-3 text-3xl font-black tracking-tight text-[#111827]">{value}</div>
            <p className="mt-2 text-xs font-medium text-[#6B7280]">{hint}</p>
          </div>
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-lg shadow-[#2E2A8C]/20 transition-transform group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinkCard({ title, href, description }: { title: string; href: string; description: string }) {
  return (
    <a href={href} className="block">
      <Card className="rounded-3xl border-[#E5E7EB] bg-white shadow-sm shadow-slate-200/70 transition-all hover:-translate-y-0.5 hover:border-[#6D6AF8]/40 hover:shadow-lg hover:shadow-[#2E2A8C]/10">
        <CardHeader>
          <CardTitle className="text-lg font-black text-[#111827]">{title}</CardTitle>
          <CardDescription className="leading-6 text-[#6B7280]">{description}</CardDescription>
        </CardHeader>
      </Card>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-32 rounded-3xl border border-[#E5E7EB] bg-white" />)}
      </div>
      <div className="h-96 rounded-3xl border border-[#E5E7EB] bg-white" />
    </div>
  );
}
