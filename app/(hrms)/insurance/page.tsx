import Link from "next/link";
import { ModulePageBody } from "@/components/hrms/module-page-body";
import { SocialInsuranceClient } from "@/components/enterprise/social-insurance-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InsurancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = query.tab === "social" ? "social" : "medical";

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">إدارة الموظفين</p>
          <h1 className="text-2xl font-bold tracking-tight">التأمينات</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة التأمين الطبي والتأمينات الاجتماعية من مكان واحد.</p>
        </div>
        <div className="inline-flex w-fit rounded-xl border bg-card p-1">
          <Link href="/insurance" className={cn("rounded-lg px-4 py-2 text-sm font-semibold", activeTab === "medical" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>التأمين الطبي</Link>
          <Link href="/insurance?tab=social" className={cn("rounded-lg px-4 py-2 text-sm font-semibold", activeTab === "social" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>التأمينات الاجتماعية</Link>
        </div>
      </div>
      {activeTab === "social" ? <SocialInsuranceClient /> : <ModulePageBody resourceKey="insurance" query={query} />}
    </section>
  );
}
