import { prisma } from "@/lib/prisma";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";

export default async function Page() {
  const rows = await (prisma as any).integrationSetting.findMany({ take: 100, orderBy: { key: "desc" } }).catch(() => []);
  return <IntegrationShell title="Settings" description="Provider-level integration settings and secrets."><DataCard title="Settings"><SimpleTable columns={['key', 'value', 'isSecret', 'description', 'updatedAt']} rows={rows as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
