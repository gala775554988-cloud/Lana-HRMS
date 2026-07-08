import { notFound } from "next/navigation";
import { getPhase2Suite, titleFromSlug } from "@/lib/phase2/catalog";
import { listPhase2Records } from "@/lib/phase2/store";
import { Phase2FeatureNav, Phase2Form, Phase2Header, Phase2Nav, Phase2Table } from "@/components/phase2/phase2-ui";

export default async function Phase2FeaturePage({ params, searchParams }: { params: Promise<{ suite: string; feature: string }>; searchParams: Promise<{ search?: string }> }) {
  const { suite: suiteKey, feature } = await params;
  const { search = "" } = await searchParams;
  const suite = getPhase2Suite(suiteKey);
  if (!suite || !suite.features.includes(feature as never)) notFound();
  const rows = await listPhase2Records(suiteKey, feature, search);
  return (
    <section className="space-y-6">
      <Phase2Header title={`${suite.title} — ${titleFromSlug(feature)}`} description="Records are persisted through Prisma AppSetting, exposed through API routes, and managed with working server actions." />
      <Phase2Nav />
      <Phase2FeatureNav suite={suite} />
      <Phase2Form suite={suiteKey} feature={feature} />
      <Phase2Table suite={suiteKey} feature={feature} rows={rows} />
    </section>
  );
}
