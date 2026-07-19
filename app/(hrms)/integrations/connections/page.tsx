import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { createOdooConnection, testOdooConnection } from "@/lib/integrations/service";

export const dynamic = "force-dynamic";

async function createConnection(formData: FormData) {
  "use server";
  await createOdooConnection({ providerId: String(formData.get("providerId") || ""), name: String(formData.get("name")), baseUrl: String(formData.get("baseUrl")), database: String(formData.get("database")), username: String(formData.get("username")), password: String(formData.get("password")) });
}
async function testConnection(formData: FormData) { "use server"; await testOdooConnection(String(formData.get("id"))); }

export default async function ConnectionsPage() {
  const [providers, rows] = await Promise.all([prisma.integrationProvider.findMany().catch(() => []), prisma.integrationConnection.findMany({ include: { provider: true }, orderBy: { createdAt: "desc" } }).catch(() => [])]);
  return <IntegrationShell title="الاتصالات" description="اتصالات قواعد بيانات Odoo مع بيانات اعتماد مشفّرة وتتبّع الجلسات."><DataCard title="إنشاء اتصال Odoo"><form action={createConnection} className="grid gap-3 md:grid-cols-3"><select name="providerId" className="h-10 rounded-md border bg-background px-3">{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><Input name="name" placeholder="Odoo Production" required /><Input name="baseUrl" placeholder="https://odoo.example.com" required /><Input name="database" placeholder="odoo_db" required /><Input name="username" placeholder="admin@example.com" required /><Input name="password" type="password" placeholder="كلمة المرور / مفتاح API" required /><Button type="submit">إنشاء</Button></form></DataCard><DataCard title="الاتصالات"><SimpleTable columns={["name", "baseUrl", "database", "username", "uid", "status", "lastTestAt", "lastError"]} rows={rows as unknown as Array<Record<string, unknown>>} />{rows.map((row) => <form key={row.id} action={testConnection} className="mt-2 inline-flex me-2"><input type="hidden" name="id" value={row.id} /><Button type="submit" variant="outline" size="sm">اختبار {row.name}</Button></form>)}</DataCard></IntegrationShell>;
}
