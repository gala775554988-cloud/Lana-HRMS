import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEnterpriseDashboardMetrics } from "@/lib/enterprise/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const titles: Record<string, string> = {
  supervisor: "لوحة المشرف",
  branch: "لوحة مدير الفرع",
  department: "لوحة مدير القسم",
  hr: "لوحة الموارد البشرية",
  payroll: "لوحة الرواتب",
  insurance: "لوحة التأمين",
  residency: "لوحة الإقامة",
  project: "لوحة مدير المشروع",
  warehouse: "لوحة المستودع"
};

export default async function EnterpriseDashboardPage({ params }: { params: Promise<{ dashboard: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dashboard } = await params;
  const metrics = await getEnterpriseDashboardMetrics(session.user.id, (session.user.roles as string[]) ?? [], dashboard);
  const title = titles[dashboard] ?? "لوحة المؤسسة";
  const cards = [
    ["الموظفون ضمن النطاق", metrics.employees],
    ["الموافقات المعلّقة", metrics.pendingApprovals],
    ["الإجازات المعلّقة", metrics.pendingLeaves],
    ["سجلات الحضور", metrics.attendanceRecords],
    ["المستندات", metrics.documents],
    ["الأصول", metrics.assets],
    ["الإشعارات غير المقروءة", metrics.unreadNotifications]
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">لوحة حسب الدور</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">الإحصائيات مقتصرة على تسلسلك الهرمي وصلاحياتك الحالية.</p>
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
