import { notFound } from "next/navigation";
import { getSaasSuite, titleFromSlug } from "@/lib/saas/catalog";
import { listSaasRecords } from "@/lib/saas/actions";
import { SaasFeatureNav, SaasForm, SaasHeader, SaasNav, SaasTable } from "@/components/saas/saas-ui";

function modelFor(suite:string, feature:string){ if(suite!=="saas-billing") return "saasPlatformRecord"; return ({"subscription-plans":"saasPlan",invoices:"saasInvoice",payments:"saasPayment",coupons:"saasCoupon","usage-billing":"saasUsageRecord","license-management":"saasLicense"} as Record<string,string>)[feature] || "saasPlatformRecord"; }
export default async function SaasFeaturePage({ params, searchParams }: { params: Promise<{ suite:string; feature:string }>; searchParams: Promise<{ search?:string }> }) {
  const { suite: suiteKey, feature } = await params; const { search="" } = await searchParams; const suite=getSaasSuite(suiteKey); if(!suite||!suite.features.includes(feature as never)) notFound(); const rows=await listSaasRecords(suiteKey,feature,search);
  return <section className="space-y-6"><SaasHeader title={`${suite.title} — ${titleFromSlug(feature)}`} description="Prisma-backed SaaS platform records with RBAC, APIs, UI, and audit logging."/><SaasNav/><SaasFeatureNav suite={suite}/><SaasForm suite={suiteKey} feature={feature}/><SaasTable suite={suiteKey} feature={feature} rows={rows as Array<Record<string,unknown>&{id:string}>} model={modelFor(suiteKey,feature)}/></section>;
}
