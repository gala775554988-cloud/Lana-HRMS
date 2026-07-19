import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { requireIntegrationAccess } from "@/lib/integrations/service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createJob(formData: FormData) { "use server"; await requireIntegrationAccess("manage"); await prisma.integrationJob.create({ data: { connectionId: String(formData.get("connectionId") || "") || null, mappingId: String(formData.get("mappingId") || "") || null, name: String(formData.get("name")), type: String(formData.get("type") || "CRON_SYNC"), direction: String(formData.get("direction") || "BIDIRECTIONAL"), schedule: String(formData.get("schedule") || "*/15 * * * *"), status: "PENDING", runAt: new Date() } }); revalidatePath("/integrations/jobs"); }

export default async function JobsPage() {
  const [connections, mappings, rows] = await Promise.all([prisma.integrationConnection.findMany().catch(() => []), prisma.integrationMapping.findMany().catch(() => []), prisma.integrationJob.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => [])]);
  return <IntegrationShell title="المهام" description="المهام المجدولة (Cron) والمزامنة الخلفية المجدولة."><DataCard title="إنشاء مهمة مجدولة (Cron)"><form action={createJob} className="grid gap-3 md:grid-cols-4"><select name="connectionId" className="h-10 rounded-md border bg-background px-3"><option value="">بدون اتصال</option>{connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="mappingId" className="h-10 rounded-md border bg-background px-3"><option value="">جميع التخطيطات</option>{mappings.map((m) => <option key={m.id} value={m.id}>{m.hrmsModule}</option>)}</select><Input name="name" placeholder="مزامنة Odoo كل 15 دقيقة" required /><Input name="schedule" defaultValue="*/15 * * * *" /><Input name="type" defaultValue="CRON_SYNC" /><Input name="direction" defaultValue="BIDIRECTIONAL" /><Button type="submit">إنشاء</Button></form></DataCard><DataCard title="المهام"><SimpleTable columns={["createdAt", "name", "type", "status", "direction", "schedule", "attempts", "lastError"]} rows={rows as unknown as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
