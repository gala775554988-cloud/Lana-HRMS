import Link from "next/link";
import { hrmsModules } from "@/config/hrms";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { WorkspaceHeader } from "@/components/hrms/workspace-ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  return (
    <section className="space-y-5" dir="rtl">
      <WorkspaceHeader title="التقارير" description="اختر التقرير المطلوب، ثم حدّد الفترة والفلاتر من داخله." />
      <div className="overflow-hidden rounded-xl border bg-card">
        {hrmsModules.filter((entity) => entity.key !== "audit-logs" && entity.key !== "reports").map((entity) => (
          <Link key={entity.key} href={"/" + entity.key} className="group flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0 hover:bg-muted/40">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BarChart3 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{entity.title}</span>
              <span className="block truncate text-sm text-muted-foreground">{entity.description}</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-primary">فتح التقرير <ArrowLeft className="h-4 w-4" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
