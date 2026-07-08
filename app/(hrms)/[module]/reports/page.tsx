import { ModuleTabs } from "@/components/hrms/module-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getHrmsModule } from "@/config/hrms";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Download, BarChart2 } from "lucide-react";
import Link from "next/link";

export default async function ModuleReportsPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resource = getHrmsModule(module);
  if (!resource) notFound();

  return (
    <div className="space-y-6">
      <ModuleTabs module={module} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">تقارير {resource.title}</h1>
        <p className="text-muted-foreground mt-2">تصدير تقارير تفصيلية من بيانات النظام الحالية.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-500" /> تقرير القائمة الشامل</CardTitle>
            <CardDescription>تصدير جميع بيانات {resource.title} حسب الصلاحيات الحالية</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link href={`/api/hr/${module}/export?format=xlsx`}><Download className="h-4 w-4" /> Excel</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link href={`/api/hr/${module}/export?format=csv`}><Download className="h-4 w-4" /> CSV</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link href={`/api/hr/${module}/export?format=pdf`}><Download className="h-4 w-4" /> PDF</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-emerald-500" /> الإحصائيات التحليلية</CardTitle>
            <CardDescription>مؤشرات الأداء الخاصة بهذه الوحدة</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="w-full gap-2">
              <Link href={`/${module}/dashboard`}>عرض التقرير</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
