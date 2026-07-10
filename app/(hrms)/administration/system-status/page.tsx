import { redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, CircleDashed, Database, HardDrive, Server, Users, XCircle } from "lucide-react";
import { auth } from "@/auth";
import { getSystemHealthReport, type HealthStatus } from "@/lib/system/health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemRepairButton } from "@/components/admin/system-repair-button";

function canViewSystem(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || roles?.includes("SYSTEM_ADMIN") || permissions?.includes("*:*") || permissions?.includes("read:settings") || permissions?.includes("manage:settings"));
}

function statusIcon(status: HealthStatus) {
  if (status === "OK") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "ERROR") return <XCircle className="h-5 w-5 text-red-600" />;
  if (status === "DEGRADED") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  return <CircleDashed className="h-5 w-5 text-slate-500" />;
}

function statusVariant(status: HealthStatus) {
  if (status === "OK") return "success" as const;
  if (status === "DEGRADED") return "warning" as const;
  if (status === "ERROR") return "default" as const;
  return "outline" as const;
}

export default async function SystemStatusPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canViewSystem(session)) redirect("/dashboard");

  const report = await getSystemHealthReport();
  const cards = [
    { label: "آخر Migration", value: report.summary.latestMigration ?? "-", icon: Database },
    { label: "إصدار النظام", value: report.version, icon: Server },
    { label: "عدد المستخدمين", value: String(report.summary.userCount ?? "-"), icon: Users },
    { label: "عدد الموظفين", value: String(report.summary.employeeCount ?? "-"), icon: Users },
    { label: "آخر مزامنة", value: report.summary.lastSync ?? "لا يوجد", icon: Activity },
    { label: "Storage", value: report.items.find((item) => item.key === "storage")?.status ?? "-", icon: HardDrive },
  ];

  return (
    <section className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">الإدارة → حالة النظام</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">حالة النظام</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            فحص تشغيل النظام، قاعدة البيانات، Prisma Migrations، الأعمدة المطلوبة، Odoo، التخزين، وإحصائيات التشغيل قبل أي تطوير أو نشر جديد.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            {statusIcon(report.status)}
            <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
            <span className="text-sm text-muted-foreground">آخر فحص: {new Date(report.checkedAt).toLocaleString("ar-SA")}</span>
          </div>
          <SystemRepairButton />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{card.label}</CardTitle>
              </CardHeader>
              <CardContent><div className="truncate text-lg font-semibold">{card.value}</div></CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تفاصيل Health Check</CardTitle>
          <CardDescription>إذا وجد نقص يظهر هنا برسالة واضحة بدلاً من تعطيل تسجيل الدخول بصمت.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.items.map((healthItem) => (
            <div key={healthItem.key} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {statusIcon(healthItem.status)}
                  <div>
                    <div className="font-semibold">{healthItem.label}</div>
                    <div className="text-sm text-muted-foreground">{healthItem.message}</div>
                  </div>
                </div>
                <Badge variant={statusVariant(healthItem.status)}>{healthItem.status}</Badge>
              </div>
              {healthItem.details ? (
                <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground" dir="ltr">
                  {JSON.stringify(healthItem.details, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
