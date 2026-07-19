import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { seedOdooProvider } from "@/lib/integrations/service";

export const dynamic = "force-dynamic";

export default async function IntegrationsDashboard() {
  const [providers, connections, mappings, queued, jobs, conflicts] = await Promise.all([
    prisma.integrationProvider.count().catch(() => 0),
    prisma.integrationConnection.count().catch(() => 0),
    prisma.integrationMapping.count().catch(() => 0),
    prisma.integrationQueue.count({ where: { status: { in: ["PENDING", "RETRY", "PROCESSING"] } } }).catch(() => 0),
    prisma.integrationJob.count().catch(() => 0),
    prisma.conflictLog.count({ where: { resolution: "PENDING" } }).catch(() => 0),
  ]);
  const logs = await prisma.integrationLog.findMany({ take: 10, orderBy: { createdAt: "desc" } }).catch(() => []);

  async function seed() { "use server"; await seedOdooProvider(); }

  return (
    <IntegrationShell title="ERP Integrations" description="Enterprise integration hub for Odoo JSON-RPC, synchronization, queues, jobs, webhooks, API keys, and OAuth clients.">
      <div className="flex flex-wrap gap-2">
        <form action={seed}><Button type="submit">Initialize Odoo Provider & Mappings</Button></form>
        <a href="/integrations/duplicate-national-ids"><Button variant="outline">تقرير أرقام الهوية المكررة</Button></a>
        <a href="/integrations/synchronization"><Button variant="outline">المزامنة</Button></a>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[ ["Providers", providers], ["Connections", connections], ["Mappings", mappings], ["Queued", queued], ["Jobs", jobs], ["Conflicts", conflicts] ].map(([label, value]) => <DataCard key={String(label)} title={String(label)}><div className="text-3xl font-bold">{String(value)}</div></DataCard>)}
      </div>
      <DataCard title="Recent Integration Logs"><SimpleTable columns={["createdAt", "level", "action", "message"]} rows={logs as unknown as Array<Record<string, unknown>>} /></DataCard>
    </IntegrationShell>
  );
}
