import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { requireIntegrationAccess, seedOdooProvider } from "@/lib/integrations/service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createMapping(formData: FormData) { "use server"; await requireIntegrationAccess("manage"); await prisma.integrationMapping.create({ data: { providerId: String(formData.get("providerId")), connectionId: String(formData.get("connectionId") || "") || null, name: String(formData.get("name")), hrmsModule: String(formData.get("hrmsModule")), hrmsModel: String(formData.get("hrmsModel")), externalModel: String(formData.get("externalModel")), direction: String(formData.get("direction") || "BIDIRECTIONAL"), fieldMap: JSON.parse(String(formData.get("fieldMap") || "{}")), isActive: true } }); revalidatePath("/integrations/mappings"); }
async function seedMappings() { "use server"; await seedOdooProvider(); }

export default async function MappingsPage() {
  const [providers, connections, rows] = await Promise.all([prisma.integrationProvider.findMany().catch(() => []), prisma.integrationConnection.findMany().catch(() => []), prisma.integrationMapping.findMany({ orderBy: { hrmsModule: "asc" } }).catch(() => [])]);
  return <IntegrationShell title="التعيينات" description="خرائط الحقول بين وحدات نظام الموارد البشرية ونماذج أودو."><form action={seedMappings}><Button type="submit">تعبئة تعيينات أودو القياسية</Button></form><DataCard title="إنشاء تعيين"><form action={createMapping} className="grid gap-3 md:grid-cols-4"><select name="providerId" className="h-10 rounded-md border bg-background px-3">{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select name="connectionId" className="h-10 rounded-md border bg-background px-3"><option value="">عام</option>{connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Input name="name" placeholder="الموظفون" required /><Input name="hrmsModule" placeholder="employees" required /><Input name="hrmsModel" placeholder="employee" required /><Input name="externalModel" placeholder="hr.employee" required /><Input name="direction" defaultValue="BIDIRECTIONAL" /><textarea name="fieldMap" className="min-h-20 rounded-md border bg-background px-3 py-2 md:col-span-3" defaultValue={'{"firstName":"name","email":"work_email"}'} /><Button type="submit">إنشاء</Button></form></DataCard><DataCard title="التعيينات"><SimpleTable columns={["name", "hrmsModule", "hrmsModel", "externalModel", "direction", "fieldMap", "isActive"]} rows={rows as unknown as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
