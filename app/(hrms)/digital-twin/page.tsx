import { listIntelligentRecords } from "@/lib/intelligent/actions";
import { IntelligentFeatureNav, IntelligentForm, IntelligentHeader, IntelligentNav, IntelligentTable } from "@/components/intelligent/intelligent-ui";
import { getIntelligentArea } from "@/lib/intelligent/catalog";

export default async function DigitalTwinPage() {
  const area = getIntelligentArea("digital-twin")!;
  const rows = await listIntelligentRecords("digital-twin", "organization-simulation", "");
  return <section className="space-y-6"><IntelligentHeader title="Digital Twin" description="Organization, workforce, hiring, budget, promotion, department growth, comparison, and recommendation simulations."/><IntelligentNav/><IntelligentFeatureNav area={area}/><IntelligentForm area="digital-twin" feature="organization-simulation"/><IntelligentTable rows={rows as Array<Record<string,unknown>&{id:string}>}/></section>;
}
