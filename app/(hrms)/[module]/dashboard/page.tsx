import { ModuleTabs } from "@/components/hrms/module-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHrmsModule } from "@/config/hrms";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ModuleDashboardPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resource = getHrmsModule(module);
  if (!resource) notFound();

  let count = 0;
  let activeCount = 0;
  const hasActiveFilter = resource.filterFields.some((field) => field === "isActive");

  try {
    const modelDelegate = (prisma as any)[resource.model];
    if (modelDelegate && modelDelegate.count) {
      count = await modelDelegate.count();
      if (hasActiveFilter) {
        activeCount = await modelDelegate.count({ where: { isActive: true } }).catch(() => 0);
      }
    } else {
      // Fallback for settings array based modules
      const settingKey = `LIST_${resource.model}`;
      const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
      if (setting && Array.isArray(setting.value)) {
        count = setting.value.length;
        activeCount = setting.value.filter((item: any) => item.isActive).length;
      }
    }
  } catch (e) {
    console.error("Dashboard count error", e);
  }

  return (
    <div className="space-y-6">
      <ModuleTabs module={module} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">لوحة تحكم {resource.title}</h1>
        <p className="text-muted-foreground mt-2">مؤشرات أداء {resource.title} الحية من النظام.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي {resource.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{count}</p>
          </CardContent>
        </Card>
        {hasActiveFilter && (
          <Card className="hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">النشط حالياً</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
