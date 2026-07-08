import Link from "next/link";
import { saasSuites } from "@/lib/saas/catalog";
import { saasMetrics } from "@/lib/saas/actions";
import { SaasHeader } from "@/components/saas/saas-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SaasPlatformPage() {
  const total = await saasMetrics();
  return <section className="space-y-6"><SaasHeader title="Production SaaS Platform" description="Billing, customer portal, marketplace, plugin SDK, deployment, backup, disaster recovery, observability, performance, compliance, localization, mobile, AI, warehouse, automation, and quality."/><Card><CardHeader><CardTitle>SaaS Records</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{total}</div></CardContent></Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{saasSuites.map(suite=><Card key={suite.key}><CardHeader><CardTitle>{suite.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{suite.features.map(feature=><Link key={feature} className="rounded-full border px-3 py-1 text-xs hover:bg-accent" href={`/saas-platform/${suite.key}/${feature}`}>{feature}</Link>)}</CardContent></Card>)}</div></section>;
}
