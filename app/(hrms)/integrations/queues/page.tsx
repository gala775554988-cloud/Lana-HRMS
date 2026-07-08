import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { processIntegrationQueue, retryDeadLetter } from "@/lib/integrations/service";

async function processQueue() { "use server"; await processIntegrationQueue(20); }
async function retry(formData: FormData) { "use server"; await retryDeadLetter(String(formData.get("id"))); }

export default async function QueuesPage() {
  const rows = await prisma.integrationQueue.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="Queues" description="Retry, dead letter queue, background jobs, and batch queue processing."><form action={processQueue}><Button type="submit">Process Queue Batch</Button></form><DataCard title="Queue Items"><SimpleTable columns={["createdAt", "queueName", "status", "direction", "operation", "entity", "entityId", "attempts", "lastError"]} rows={rows as unknown as Array<Record<string, unknown>>} />{rows.filter((r) => r.status === "DEAD").map((r) => <form key={r.id} action={retry} className="mt-2 inline-flex me-2"><input type="hidden" name="id" value={r.id} /><Button type="submit" size="sm" variant="outline">Retry {r.entity}</Button></form>)}</DataCard></IntegrationShell>;
}
