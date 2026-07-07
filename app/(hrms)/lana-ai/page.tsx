import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLanaAiMonitorData } from "@/lib/enterprise/lana-ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LanaAiMonitorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user.roles as string[]) ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) redirect("/dashboard");

  const monitor = await getLanaAiMonitorData();
  const cards = [
    ["عدد الأخطاء", monitor.errors],
    ["الاستعلامات البطيئة", monitor.slowQueries],
    ["المشاكل", monitor.problems],
    ["البيانات الناقصة", monitor.missingData],
    ["المستخدمين غير النشطين", monitor.inactiveUsers],
    ["موظفون لم يحدثوا بياناتهم", monitor.notUpdatedEmployees],
    ["المستندات المنتهية", monitor.expiredDocuments],
    ["العقود المنتهية", monitor.expiredContracts],
    ["الإقامات المنتهية", monitor.expiredResidencies],
    ["التأمينات المنتهية", monitor.expiredInsurance],
    ["الجوازات المنتهية", monitor.expiredPassports]
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Lana AI</p>
        <h1 className="text-3xl font-semibold tracking-tight">لوحة مراقبة الذكاء الاصطناعي</h1>
        <p className="mt-2 text-muted-foreground">يكتشف Lana AI المشاكل ويقترح الحلول دون تنفيذ أي تعديل إلا بعد موافقة Super Admin.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => <Card key={String(label)}><CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{value}</CardContent></Card>)}
      </div>
      <Card>
        <CardHeader><CardTitle>اقتراحات الإصلاح</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {monitor.suggestions.map((suggestion) => (
            <div key={suggestion} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span>{suggestion}</span>
              <button type="button" className="rounded-lg border px-3 py-1 text-xs text-muted-foreground" disabled>تنفيذ الإصلاح</button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
