import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccessProfile, buildEmployeeScopeWhere } from "@/lib/enterprise/hierarchy";
import { Users, GitPullRequest, CalendarClock, BarChart3, Star, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة تحكم المدير | Lana HRMS",
  description: "نظرة سريعة على فريقك، الاعتمادات المعلقة، والحضور."
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function ManagerDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const roles = (session.user.roles as string[]) ?? [];
  const profile = await getAccessProfile(session.user.id, roles);
  const teamScope = await buildEmployeeScopeWhere(profile);
  // buildEmployeeScopeWhere always includes the manager's own employee row in
  // the OR -- exclude it here so "team size" reflects direct reports, not
  // the manager themselves.
  const teamWhereExcludingSelf = profile.employee
    ? { AND: [teamScope, { id: { not: profile.employee.id } }] }
    : teamScope;

  const [teamSize, waitingApprovals, presentToday, teamMembers] = await Promise.all([
    prisma.employee.count({ where: teamWhereExcludingSelf as any }),
    prisma.workflowStep.count({ where: { approverUserId: session.user.id, status: "PENDING" } }),
    prisma.attendanceRecord.count({ where: { employee: teamWhereExcludingSelf as any, workDate: { gte: startOfToday() }, status: "PRESENT" } }),
    prisma.employee.findMany({
      where: teamWhereExcludingSelf as any,
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: { select: { title: true } } },
      take: 8,
      orderBy: { firstName: "asc" }
    })
  ]);

  const shortcuts = [
    { title: "فريقي", description: "استعراض أعضاء الفريق وبياناتهم.", href: "/employees?tab=my-team", icon: Users, gradient: "from-teal-600 to-emerald-600" },
    { title: "اعتماد الطلبات", description: "الطلبات بانتظار موافقتك المباشرة.", href: "/approvals?tab=inbox", icon: GitPullRequest, gradient: "from-amber-500 to-orange-500" },
    { title: "حضور الفريق", description: "متابعة حضور وانصراف أعضاء فريقك.", href: "/attendance", icon: CalendarClock, gradient: "from-blue-600 to-cyan-600" },
    { title: "تقارير الفريق", description: "أداء ونشاط الفريق خلال الفترة.", href: "/reports", icon: BarChart3, gradient: "from-indigo-600 to-purple-600" },
    { title: "تقييم الأداء", description: "تقييمات الأداء الدورية للفريق.", href: "/performance", icon: Star, gradient: "from-rose-500 to-pink-600" }
  ];

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      <div className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/60 p-6 sm:p-8 shadow-xl shadow-teal-900/5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-teal-950/30">
        <Badge className="bg-gradient-to-r from-teal-600 to-emerald-600 px-3 py-1 text-xs font-black text-white shadow-sm">لوحة تحكم المدير</Badge>
        <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          أهلاً بك، <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600">{session.user.name || "المدير"}</span>
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">نظرة سريعة على فريقك، الاعتمادات المعلقة، والحضور اليومي.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">حجم الفريق</p>
          <p className="mt-2 text-3xl font-black">{teamSize}</p>
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">طلبات بانتظار موافقتي</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{waitingApprovals}</p>
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">حاضرون اليوم</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{presentToday}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-extrabold mb-4">أعضاء الفريق</h2>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد أعضاء في فريقك حالياً.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member) => (
              <Link key={member.id} href={`/employees/${member.id}`} className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-muted/40 transition">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white text-sm font-black">
                  {member.firstName?.charAt(0) || "?"}
                </span>
                <span className="min-w-0">
                  <p className="text-sm font-bold truncate">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.position?.title || member.employeeNumber}</p>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
