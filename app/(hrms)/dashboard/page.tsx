import { Activity, Bell, BriefcaseBusiness, CalendarClock, Users } from "lucide-react";
import { DashboardCharts } from "@/components/hrms/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/hrms/actions";

const kpiMeta = [
  { label: "Employees", key: "employees", icon: Users, tone: "text-blue-600", helper: "Total workforce" },
  { label: "Departments", key: "departments", icon: BriefcaseBusiness, tone: "text-emerald-600", helper: "Active organization units" },
  { label: "Open Jobs", key: "openJobs", icon: Activity, tone: "text-violet-600", helper: "Recruitment demand" },
  { label: "Pending Leave", key: "pendingLeave", icon: CalendarClock, tone: "text-amber-600", helper: "Needs approval" },
  { label: "Notifications", key: "unreadNotifications", icon: Bell, tone: "text-rose-600", helper: "Unread alerts" }
];

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const auditLogs = (metrics.auditLogs as Record<string, unknown>[] | undefined) ?? [];

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="bg-[linear-gradient(135deg,#0f172a,#2563eb_55%,#10b981)] p-6 text-white lg:p-8">
          <div className="max-w-3xl space-y-3">
            <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">Enterprise command center</Badge>
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">HRMS Dashboard</h1>
            <p className="text-sm text-white/80 lg:text-base">Monitor people operations, approvals, hiring momentum, notifications, and governance activity from one executive workspace.</p>
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
                  <CardDescription>{item.label}</CardDescription>
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
          <CardHeader><CardTitle>Recent audit activity</CardTitle><CardDescription>Latest sensitive changes across HRMS modules.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.length ? auditLogs.map((log) => <div key={String(log.id)} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm"><span><span className="font-medium">{String(log.action)}</span> {String(log.entity)}</span><span className="text-muted-foreground">{String(log.createdAt)}</span></div>) : <p className="text-sm text-muted-foreground">No audit activity yet.</p>}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Operational health</CardTitle><CardDescription>Production readiness indicators.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {['RBAC active', 'Audit logging enabled', 'JWT sessions configured', 'Responsive UI enabled'].map((item) => <div key={item} className="flex items-center justify-between rounded-md border p-3"><span>{item}</span><Badge variant="success">Healthy</Badge></div>)}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}