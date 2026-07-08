import { prisma } from "@/lib/prisma";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";

export default async function Page() {
  const rows = await (prisma as any).integrationApiKey.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="API Keys" description="Scoped API keys with encrypted secrets and hashes."><DataCard title="API Keys"><SimpleTable columns={['name', 'scopes', 'expiresAt', 'lastUsedAt', 'isActive', 'createdAt']} rows={rows as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
