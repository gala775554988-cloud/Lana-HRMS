import Link from "next/link";
import { intelligentAreas } from "@/lib/intelligent/catalog";
import { intelligentMetrics } from "@/lib/intelligent/actions";
import { IntelligentHeader } from "@/components/intelligent/intelligent-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function IntelligentPage(){ const total=await intelligentMetrics(); return <section className="space-y-6"><IntelligentHeader title="Intelligent Enterprise Platform" description="Digital twin, AI decisions, knowledge graph, global search, AI assistant, low-code, process mining, data fabric, predictive analytics, generative reports, observability, edge, multi-region, and zero trust."/><Card><CardHeader><CardTitle>Intelligent Records</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{total}</div></CardContent></Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{intelligentAreas.map(a=><Card key={a.key}><CardHeader><CardTitle>{a.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{a.features.map(f=><Link key={f} className="rounded-full border px-3 py-1 text-xs hover:bg-accent" href={`/intelligent/${a.key}/${f}`}>{f}</Link>)}</CardContent></Card>)}</div></section>; }
