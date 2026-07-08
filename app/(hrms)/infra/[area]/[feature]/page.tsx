import { notFound } from "next/navigation";
import { getInfraArea, titleFromSlug } from "@/lib/infra/catalog";
import { listInfraRecords } from "@/lib/infra/actions";
import { InfraFeatureNav, InfraForm, InfraHeader, InfraNav, InfraTable } from "@/components/infra/infra-ui";

export default async function InfraFeaturePage({ params, searchParams }: { params: Promise<{ area: string; feature: string }>; searchParams: Promise<{ search?: string }> }) {
  const { area: areaKey, feature } = await params;
  const { search = "" } = await searchParams;
  const area = getInfraArea(areaKey);
  if (!area || !area.features.includes(feature as never)) notFound();
  const rows = await listInfraRecords(areaKey, feature, search);
  return (
    <section className="space-y-6">
      <InfraHeader title={`${area.title} — ${titleFromSlug(feature)}`} description="Prisma-backed infrastructure records with RBAC, server actions, APIs, and audit logging." />
      <InfraNav />
      <InfraFeatureNav area={area} />
      <InfraForm area={areaKey} feature={feature} />
      <InfraTable area={areaKey} feature={feature} rows={rows as Array<Record<string, unknown> & { id: string }>} />
    </section>
  );
}
