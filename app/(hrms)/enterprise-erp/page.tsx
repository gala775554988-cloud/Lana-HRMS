import Link from "next/link";
import { erpSuites } from "@/lib/enterprise-erp/catalog";
import { ensureOpenApiDocument, erpMetrics } from "@/lib/enterprise-erp/actions";
import { ErpHeader } from "@/components/enterprise-erp/erp-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EnterpriseErpPage() {
  await ensureOpenApiDocument().catch(() => null);
  const metrics = await erpMetrics();
  return (
    <section className="space-y-6">
      <ErpHeader title="Enterprise ERP Platform" description="Financial, procurement, inventory, medical ERP, CRM, help desk, visitor, fleet, mobile, AI, BI, workflow designer, multi-tenancy, public APIs, and production hardening." />
      <div className="grid gap-4 md:grid-cols-5">{Object.entries(metrics).map(([key, value]) => <Card key={key}><CardHeader><CardTitle className="text-sm text-muted-foreground">{key}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div></CardContent></Card>)}</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{erpSuites.map((suite) => <Card key={suite.key}><CardHeader><CardTitle>{suite.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{suite.features.map((feature) => <Link key={feature} className="rounded-full border px-3 py-1 text-xs hover:bg-accent" href={`/enterprise-erp/${suite.key}/${feature}`}>{feature}</Link>)}</CardContent></Card>)}</div>
    </section>
  );
}
