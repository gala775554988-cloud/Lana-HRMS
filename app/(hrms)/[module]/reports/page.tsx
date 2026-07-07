import { ModuleTabs } from "@/components/hrms/module-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHrmsModule } from "@/config/hrms";
import { notFound } from "next/navigation";

export default async function ModuleReportsPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resource = getHrmsModule(module);
  if (!resource) notFound();

  return (
    <div className="space-y-6">
      <ModuleTabs module={module} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">تقارير {resource.title}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>التقارير</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">تصدير Excel و PDF.</p></CardContent>
      </Card>
    </div>
  );
}
