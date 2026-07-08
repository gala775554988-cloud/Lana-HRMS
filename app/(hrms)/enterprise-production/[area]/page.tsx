import { notFound } from "next/navigation";
import { getProductionArea } from "@/lib/enterprise-production/catalog";
import { listProductionRecords } from "@/lib/enterprise-production/actions";
import { ProductionForm, ProductionHeader, ProductionNav, ProductionTable } from "@/components/enterprise-production/production-ui";

export default async function ProductionAreaPage({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<{ search?: string }> }) {
  const { area: areaKey } = await params;
  const { search = "" } = await searchParams;
  const area = getProductionArea(areaKey);
  if (!area) notFound();
  const rows = await listProductionRecords(areaKey, search);
  return (
    <section className="space-y-6">
      <ProductionHeader title={area.title} description={`${area.title} records are stored in Prisma and managed through server actions and API routes.`} />
      <ProductionNav />
      <ProductionForm area={area.key} features={area.features} />
      <ProductionTable area={area.key} rows={rows as Array<Record<string, unknown> & { id: string }>} />
    </section>
  );
}
