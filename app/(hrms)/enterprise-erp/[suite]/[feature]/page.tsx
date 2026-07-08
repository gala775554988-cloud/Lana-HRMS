import { notFound } from "next/navigation";
import { getErpSuite, titleFromSlug } from "@/lib/enterprise-erp/catalog";
import { listErpRecords } from "@/lib/enterprise-erp/actions";
import { ErpFeatureNav, ErpForm, ErpHeader, ErpNav, ErpTable } from "@/components/enterprise-erp/erp-ui";

export default async function EnterpriseErpFeaturePage({ params, searchParams }: { params: Promise<{ suite: string; feature: string }>; searchParams: Promise<{ search?: string }> }) {
  const { suite: suiteKey, feature } = await params;
  const { search = "" } = await searchParams;
  const suite = getErpSuite(suiteKey);
  if (!suite || !suite.features.includes(feature as never)) notFound();
  const rows = await listErpRecords(suiteKey, feature, search);
  return (
    <section className="space-y-6">
      <ErpHeader title={`${suite.title} — ${titleFromSlug(feature)}`} description="Records are tenant-aware, Prisma-backed, API-accessible, workflow-enabled, auditable, and production routed." />
      <ErpNav />
      <ErpFeatureNav suite={suite} />
      <ErpForm suite={suiteKey} feature={feature} />
      <ErpTable rows={rows as Array<Record<string, unknown> & { id: string }>} />
    </section>
  );
}
