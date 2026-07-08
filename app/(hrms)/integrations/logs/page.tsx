import { prisma } from "@/lib/prisma";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";

export default async function Page() {
  const rows = await (prisma as any).integrationLog.findMany({ take: 100, orderBy: { createdAt: "desc" } }).catch(() => []);
  return <IntegrationShell title="Logs" description="Integration request/response logs and audit trail."><DataCard title="Logs"><SimpleTable columns={['createdAt', 'level', 'action', 'message', 'connectionId', 'jobId', 'queueId']} rows={rows as Array<Record<string, unknown>>} /></DataCard></IntegrationShell>;
}
