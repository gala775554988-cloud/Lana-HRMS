import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { processIntegrationQueue, retryDeadLetter } from "@/lib/integrations/service";

export const dynamic = "force-dynamic";

async function processQueue() { "use server"; await processIntegrationQueue(20); }
async function retry(formData: FormData) { "use server"; await retryDeadLetter(String(formData.get("id"))); }

export default async function QueuesPage() {
  const rows = await prisma.integrationQueue.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="قوائم الانتظار" description="إعادة المحاولة، قائمة الرسائل الميتة، المهام الخلفية، ومعالجة قوائم الانتظار على دفعات."><form action={processQueue}><Button type="submit">معالجة دفعة من القائمة</Button></form><DataCard title="عناصر القائمة"><SimpleTable columns={["createdAt", "queueName", "status", "direction", "operation", "entity", "entityId", "attempts", "lastError"]} rows={rows as unknown as Array<Record<string, unknown>>} />{rows.filter((r) => r.status === "DEAD").map((r) => <form key={r.id} action={retry} className="mt-2 inline-flex me-2"><input type="hidden" name="id" value={r.id} /><Button type="submit" size="sm" variant="outline">إعادة محاولة {r.entity}</Button></form>)}</DataCard></IntegrationShell>;
}
