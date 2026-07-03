import { DashboardCharts } from "@/components/hrms/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/hrms/actions";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const auditLogs = (metrics.auditLogs as Record<string, unknown>[] | undefined) ?? [];
  const cards: Array<[string, unknown]> = [
    ["Employees", metrics.employees],
    ["Departments", metrics.departments],
    ["Open Jobs", metrics.openJobs],
    ["Pending Leave", metrics.pendingLeave],
    ["Unread Notifications", metrics.unreadNotifications]
  ];
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Executive overview</p>
        <h1 className="text-3xl font-semibold">HRMS Dashboard</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => <Card key={String(label)}><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle>{String(value ?? 0)}</CardTitle></CardHeader></Card>)}
      </div>
      <DashboardCharts metrics={metrics} />
      <Card>
        <CardHeader><CardTitle>Recent audit activity</CardTitle><CardDescription>Latest sensitive changes across the HRMS.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.length ? auditLogs.map((log) => <div key={String(log.id)} className="rounded-md border p-3 text-sm"><span className="font-medium">{String(log.action)}</span> {String(log.entity)} <span className="text-muted-foreground">{String(log.createdAt)}</span></div>) : <p className="text-sm text-muted-foreground">No audit activity yet.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
