import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { requireIntegrationAccess } from "@/lib/integrations/service";
import { revalidatePath } from "next/cache";

async function createJob(formData: FormData) { "use server"; await requireIntegrationAccess("manage"); await prisma.integrationJob.create({ data: { connectionId: String(formData.get("connectionId") || "") || null, mappingId: String(formData.get("mappingId") || "") || null, name: String(formData.get("name")), type: String(formData.get("type") || "CRON_SYNC"), direction: String(formData.get("direction") || "BIDIRECTIONAL"), schedule: String(formData.get("schedule") || "*/15 * * * *"), status: "PENDING", runAt: new Date() } }); revalidatePath("/integrations/jobs"); }

export default async function JobsPage() {
  const [connections, mappings, rows] = await Promise.all([prisma.integrationConnection.findMany().catch(() => []), prisma.integrationMapping.findMany().catch(() => []), prisma.integrationJob.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => [])]);
  return <IntegrationShell title="Jobs" description="Cron jobs and scheduled background synchronization."><DataCard title="Create Cron Job"><form action={createJob} className="grid gap-3 md:grid-cols-4"><select name="connectionId" className="h-10 rounded-md border bg-background px-3"><option value="">No connection</option>{connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="mappingId" className="h-10 rounded-md border bg-background px-3"><option value="">All mappings</option>{mappings.map((m) => <option key={m.id} value={m.id}>{m.hrmsModule}</option>)}</select><Input name="name" placeholder="15 minute Odoo sync" required /><Input name="schedule" defaultValue="*/15 * * * *" /><Input name="type" defaultValue="CRON_SYNC" /><Input name="direction" defaultValue="BIDIRECTIONAL" /><Button type="submit">Create</Button></form></DataCard><DataCard title="Jobs"><SimpleTable columns={["createdAt", "name", "type", "status", "direction", "schedule", "attempts", "lastError"]} rows={rows as unknown as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
