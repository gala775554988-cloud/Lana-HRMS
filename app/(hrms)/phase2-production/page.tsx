import Link from "next/link";
import { phase2Suites } from "@/lib/phase2/catalog";
import { phase2Metrics } from "@/lib/phase2/store";
import { Phase2Header } from "@/components/phase2/phase2-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Phase2ProductionPage() {
  const metrics = await phase2Metrics();
  return (
    <section className="space-y-6">
      <Phase2Header title="Enterprise Production Completion" description="Database-backed centers for recruitment, LMS, payroll, attendance, performance, assets, medical, financial integrations, BI, AI, mobile API, multi-company, and compliance." />
      <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Feature Stores</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{metrics.settings}</div></CardContent></Card><Card><CardHeader><CardTitle>Records</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{metrics.records}</div></CardContent></Card></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {phase2Suites.map((suite) => <Card key={suite.key}><CardHeader><CardTitle>{suite.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{suite.features.map((feature) => <Link key={feature} className="rounded-full border px-3 py-1 text-xs hover:bg-accent" href={`/phase2-production/${suite.key}/${feature}`}>{feature}</Link>)}</CardContent></Card>)}
      </div>
    </section>
  );
}
