import { prisma } from "@/lib/prisma";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";

export default async function Page() {
  const rows = await (prisma as any).integrationWebhook.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="Webhooks" description="Signed outbound/inbound webhooks."><DataCard title="Webhooks"><SimpleTable columns={['name', 'url', 'events', 'isActive', 'lastDeliveryAt', 'lastStatus']} rows={rows as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
