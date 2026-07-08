import { prisma } from "@/lib/prisma";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";

export default async function Page() {
  const rows = await (prisma as any).integrationOAuthClient.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="OAuth Clients" description="OAuth2 client credentials for enterprise integrations."><DataCard title="OAuth Clients"><SimpleTable columns={['name', 'clientId', 'redirectUris', 'scopes', 'grants', 'isActive']} rows={rows as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
