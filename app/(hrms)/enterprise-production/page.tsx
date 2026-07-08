import Link from "next/link";
import { productionAreas } from "@/lib/enterprise-production/catalog";
import { productionMetrics } from "@/lib/enterprise-production/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionHeader } from "@/components/enterprise-production/production-ui";

export default async function EnterpriseProductionPage() {
  const metrics = await productionMetrics();
  return (
    <section className="space-y-6">
      <ProductionHeader title="Enterprise Production" description="Production-grade dashboard, workflow, reports, notifications, audit, search, files, BI, AI, API gateway, monitoring, and security centers." />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries(metrics).map(([key, value]) => <Card key={key}><CardHeader><CardTitle className="text-sm text-muted-foreground">{key}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div></CardContent></Card>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productionAreas.map((area) => <Link key={area.key} href={`/enterprise-production/${area.key}`}><Card className="h-full transition-colors hover:bg-accent"><CardHeader><CardTitle>{area.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{area.features.map((feature) => <span key={feature} className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{feature}</span>)}</CardContent></Card></Link>)}
      </div>
    </section>
  );
}
