import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEnterpriseDashboardMetrics } from "@/lib/enterprise/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const titles: Record<string, string> = {
  supervisor: "Supervisor Dashboard",
  branch: "Branch Manager Dashboard",
  department: "Department Manager Dashboard",
  hr: "HR Dashboard",
  payroll: "Payroll Dashboard",
  insurance: "Insurance Dashboard",
  residency: "Residency Dashboard",
  project: "Project Manager Dashboard",
  warehouse: "Warehouse Dashboard"
};

export default async function EnterpriseDashboardPage({ params }: { params: Promise<{ dashboard: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dashboard } = await params;
  const metrics = await getEnterpriseDashboardMetrics(session.user.id, (session.user.roles as string[]) ?? [], dashboard);
  const title = titles[dashboard] ?? "Enterprise Dashboard";
  const cards = [
    ["Employees in scope", metrics.employees],
    ["Pending approvals", metrics.pendingApprovals],
    ["Pending leaves", metrics.pendingLeaves],
    ["Attendance records", metrics.attendanceRecords],
    ["Documents", metrics.documents],
    ["Assets", metrics.assets],
    ["Unread notifications", metrics.unreadNotifications]
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Role Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">Statistics are restricted to your current hierarchy and permissions.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-3xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
