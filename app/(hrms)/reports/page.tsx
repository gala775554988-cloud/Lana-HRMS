import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { hrmsModules } from "@/config/hrms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyOverview, OverviewSkeleton } from "@/app/(hrms)/analytics/page";
import { getRequestDictionary } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  const roles = (session?.user?.roles as string[]) || [];
  const isAdmin = roles.some((role) =>
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER", "HR", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "PROJECT_MANAGER"].includes(role)
  );
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <section className="space-y-6">
      <div><p className="text-sm font-medium text-muted-foreground">التحليلات</p><h1 className="text-3xl font-semibold">التقارير</h1><p className="text-muted-foreground">نقاط الدخول للتقارير التشغيلية لكل وحدة من وحدات النظام.</p></div>

      {isAdmin ? (
        <Suspense fallback={<OverviewSkeleton showCharts={false} />}>
          <CompanyOverview locale={locale} dictionary={dictionary} showCharts={false} />
        </Suspense>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hrmsModules.filter((entity) => entity.key !== "audit-logs" && entity.key !== "reports").map((entity) => <Link key={entity.key} href={"/" + entity.key}><Card className="h-full transition-colors hover:bg-accent"><CardHeader><CardTitle>{entity.title}</CardTitle><CardDescription>{entity.description}</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">عرض الجدول المباشر والفلاتر والبيانات الجاهزة للتصدير.</p></CardContent></Card></Link>)}
      </div>
    </section>
  );
}
