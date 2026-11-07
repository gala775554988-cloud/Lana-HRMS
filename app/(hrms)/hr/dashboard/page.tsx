import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Users, FileText, FolderOpen, CalendarClock, WalletCards, BarChart3, UserPlus, Network, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildEmployeeScopeWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة تحكم الموارد البشرية | HRMS",
  description: "نظرة شاملة على الموظفين، العقود، الطلبات، والمستندات على مستوى الشركة."
};

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export default async function HrDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const permissions = session.user.permissions ?? [];
  const canRead = (resource: string) => isEnterpriseResourceAllowed(roles, resource) &&
    (roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource }, roles) ||
      permissions.includes(`manage:${resource}`));
  const canViewRequests = canRead("requests") || canRead("leave");
  const canViewRecruitment = canRead("recruitment") || canRead("candidates");
  const now = new Date();
  const soon = daysFromNow(30);
  const scope = await buildEmployeeScopeWhere(await getAccessProfile(session.user.id, roles));
  const count = (allowed: boolean, query: () => Promise<number>) => allowed ? query().catch(() => null) : null;

  const [totalEmployees, expiringContracts, expiringDocuments, waitingRequests, openCandidates] = await Promise.all([
    count(canRead("employees"), () => prisma.employee.count({ where: { AND: [scope, { status: "ACTIVE" }] } })),
    count(canRead("contracts"), () => prisma.employeeContract.count({ where: { employee: scope, status: "ACTIVE", endDate: { gte: now, lte: soon } } })),
    count(canRead("documents"), () => prisma.employeeDocument.count({ where: { employee: scope, expiresAt: { gte: now, lte: soon } } })),
    count(canViewRequests, () => prisma.workflowInstance.count({ where: { employee: scope, status: "PENDING", ...(canRead("requests") ? {} : { type: "LEAVE" }) } })),
    count(canViewRecruitment, () => prisma.candidate.count({ where: { status: { notIn: ["HIRED", "REJECTED"] } } })),
  ]);

  const shortcuts = [
    { resource: "employees", title: "إدارة الموظفين", description: "إضافة، تعديل، وأرشفة سجلات الموظفين.", href: "/employees", icon: Users, gradient: "from-teal-600 to-emerald-600" },
    { resource: "contracts", title: "العقود", description: "متابعة العقود وتواريخ الانتهاء.", href: "/contracts", icon: FileText, gradient: "from-blue-600 to-cyan-600" },
    { resource: "documents", title: "المستندات", description: "مستندات الموظفين وحالات الانتهاء.", href: "/documents", icon: FolderOpen, gradient: "from-amber-500 to-orange-500" },
    { resource: "attendance", title: "الحضور والإجازات", description: "سجلات الحضور وطلبات الإجازة.", href: "/attendance", icon: CalendarClock, gradient: "from-indigo-600 to-purple-600" },
    { resource: "payroll", title: "الرواتب", description: "مسير الرواتب والبدلات والاستقطاعات.", href: "/payroll", icon: WalletCards, gradient: "from-rose-500 to-pink-600" },
    { resource: "reports", title: "التقارير", description: "تقارير الموارد البشرية التحليلية.", href: "/reports", icon: BarChart3, gradient: "from-slate-600 to-slate-800" },
    { resource: "recruitment", title: "التوظيف", description: "مرشحو التوظيف وحالة الطلبات.", href: "/recruitment", icon: UserPlus, gradient: "from-emerald-600 to-teal-700" },
    { resource: "organization-hierarchy", title: "الهيكل التنظيمي", description: "الأقسام، الفروع، والتسلسل الإداري.", href: "/organization-hierarchy", icon: Network, gradient: "from-cyan-600 to-blue-700" }
  ].filter(item => canRead(item.resource));

  const stats = [
    { visible: canRead("employees"), label: "الموظفون النشطون", value: totalEmployees, color: "text-slate-900 dark:text-slate-100" },
    { visible: canRead("contracts"), label: "عقود تنتهي خلال 30 يوم", value: expiringContracts, color: "text-amber-600" },
    { visible: canRead("documents"), label: "مستندات تنتهي خلال 30 يوم", value: expiringDocuments, color: "text-rose-600" },
    { visible: canViewRequests, label: "طلبات معلقة", value: waitingRequests, color: "text-blue-600" },
    { visible: canViewRecruitment, label: "مرشحون قيد المتابعة", value: openCandidates, color: "text-emerald-600" }
  ].filter(stat => stat.visible);

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      <div className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/60 p-6 sm:p-8 shadow-xl shadow-teal-900/5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-teal-950/30">
        <Badge className="bg-gradient-to-r from-teal-600 to-emerald-600 px-3 py-1 text-xs font-black text-white shadow-sm">لوحة تحكم الموارد البشرية</Badge>
        <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          أهلاً بك، <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600">{session.user.name || "فريق الموارد البشرية"}</span>
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">نظرة شاملة على الموظفين، العقود، الطلبات، والمستندات ضمن صلاحيات حسابك.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`mt-2 text-3xl font-black ${stat.color}`}>{stat.value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group relative overflow-hidden rounded-3xl border p-5 transition-all hover:-translate-y-1 hover:shadow-xl bg-card">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${item.gradient} text-white shadow-md mb-3`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black flex items-center justify-between">
                <span>{item.title}</span>
                <ArrowUpRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100" />
              </h3>
              <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
