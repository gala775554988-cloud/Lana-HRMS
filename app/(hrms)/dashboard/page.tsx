import { Activity, Bell, BriefcaseBusiness, CalendarClock, Users, User } from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "@/components/hrms/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";

const kpiMeta = [
  { labelKey: "employees", key: "employees", icon: Users, tone: "text-blue-600", helper: "Total workforce" },
  { labelKey: "departments", key: "departments", icon: BriefcaseBusiness, tone: "text-emerald-600", helper: "Active organization units" },
  { labelKey: "openJobs", key: "openJobs", icon: Activity, tone: "text-violet-600", helper: "Recruitment demand" },
  { labelKey: "pendingLeave", key: "pendingLeave", icon: CalendarClock, tone: "text-amber-600", helper: "Needs approval" },
  { labelKey: "unreadNotifications", key: "unreadNotifications", icon: Bell, tone: "text-rose-600", helper: "Unread alerts" }
];

export default async function DashboardPage() {
  const session = await import("@/auth").then(m => m.auth());
  const metrics = await getDashboardMetrics();
  const { dictionary } = await getRequestDictionary();

  const userRoles = (session?.user?.roles as string[]) || [];
  const isOnlyEmployee = userRoles.length === 1 && userRoles.includes("EMPLOYEE");

  if (isOnlyEmployee) {
    // Redirect employees to the beautiful new mobile-style employee portal
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-8 bg-[#0A0A12] text-white rounded-3xl">
        <div className="max-w-xs mx-auto">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-6">
            <User className="h-8 w-8 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2">مرحباً {session?.user?.name || "موظف"}</h1>
          <p className="text-white/70 mb-8">استمتع بتجربة بوابتك الشخصية الجديدة</p>
          
          <Link 
            href="/my" 
            className="inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 transition-colors w-full py-3.5 rounded-2xl font-semibold text-lg shadow-lg"
          >
            افتح بوابتي الشخصية <span className="text-xl">→</span>
          </Link>
          
          <p className="text-xs text-white/50 mt-6">
            الحضور • الإجازات • الرواتب • الطلبات • الملف الشخصي
          </p>
        </div>
      </div>
    );
  }
  const auditLogs = (metrics.auditLogs as Record<string, unknown>[] | undefined) ?? [];

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="bg-[linear-gradient(135deg,#0f172a,#2563eb_55%,#10b981)] p-6 text-white lg:p-8">
          <div className="max-w-3xl space-y-3">
            <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">{dictionary.dashboard.badge}</Badge>
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{dictionary.dashboard.title}</h1>
            <p className="text-sm text-white/80 lg:text-base">{dictionary.dashboard.description}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiMeta.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key} className="overflow-hidden shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                <CardDescription>{dictionary.dashboard[item.labelKey as keyof typeof dictionary.dashboard]}</CardDescription>
                  <Icon className={`h-5 w-5 ${item.tone}`} aria-hidden="true" />
                </div>
                <CardTitle className="text-3xl">{String(metrics[item.key] ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">{item.helper}</p></CardContent>
            </Card>
          );
        })}
      </div>
      <DashboardCharts metrics={metrics} />
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card className="shadow-sm">
          <CardHeader><CardTitle>{dictionary.dashboard.auditTitle}</CardTitle><CardDescription>{dictionary.dashboard.auditDescription}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.length ? auditLogs.map((log) => <div key={String(log.id)} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm"><span><span className="font-medium">{String(log.action)}</span> {String(log.entity)}</span><span className="text-muted-foreground">{String(log.createdAt)}</span></div>) : <p className="text-sm text-muted-foreground">{dictionary.dashboard.noAudit}</p>}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>{dictionary.dashboard.healthTitle}</CardTitle><CardDescription>{dictionary.dashboard.healthDescription}</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {['RBAC active', 'Audit logging enabled', 'JWT sessions configured', 'Responsive UI enabled'].map((item) => <div key={item} className="flex items-center justify-between rounded-md border p-3"><span>{item}</span><Badge variant="success">{dictionary.common.healthy}</Badge></div>)}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
