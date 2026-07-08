import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { requireIntegrationAccess } from "@/lib/integrations/service";
import { revalidatePath } from "next/cache";

async function createProvider(formData: FormData) {
  "use server";
  await requireIntegrationAccess("manage");
  await prisma.integrationProvider.create({ data: { name: String(formData.get("name")), code: String(formData.get("code")), type: String(formData.get("type") || "ODOO"), baseUrl: String(formData.get("baseUrl")), authType: "ODOO_JSON_RPC", isActive: true } });
  revalidatePath("/integrations/providers");
}

export default async function ProvidersPage() {
  const rows = await prisma.integrationProvider.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="Providers" description="ERP providers such as Odoo."><DataCard title="Create Provider"><form action={createProvider} className="grid gap-3 md:grid-cols-5"><Input name="name" placeholder="Odoo Production" required /><Input name="code" placeholder="odoo-prod" required /><Input name="type" defaultValue="ODOO" /><Input name="baseUrl" placeholder="https://odoo.example.com" required /><Button type="submit">Create</Button></form></DataCard><DataCard title="Providers"><SimpleTable columns={["name", "code", "type", "baseUrl", "isActive", "createdAt"]} rows={rows as unknown as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
