import Link from "next/link";
import { infraAreas } from "@/lib/infra/catalog";
import { infraMetrics } from "@/lib/infra/actions";
import { InfraHeader } from "@/components/infra/infra-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InfraPage() {
  const total = await infraMetrics();
  return (
    <section className="space-y-6">
      <InfraHeader title="Enterprise Infrastructure" description="Event bus, queues, scheduler, notification pipeline, audit intelligence, integration hub, AI Copilot, Document AI, BI Engine, security, DevOps, monitoring, database studio, admin center, white label, and marketplace." />
      <Card><CardHeader><CardTitle>Infrastructure Records</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{total}</div></CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{infraAreas.map((area) => <Card key={area.key}><CardHeader><CardTitle>{area.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{area.features.map((feature) => <Link key={feature} className="rounded-full border px-3 py-1 text-xs hover:bg-accent" href={`/infra/${area.key}/${feature}`}>{feature}</Link>)}</CardContent></Card>)}</div>
    </section>
  );
}
