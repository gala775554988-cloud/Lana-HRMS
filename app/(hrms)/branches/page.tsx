import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { HospitalsClient } from "@/components/hrms/hospitals-client";
import { Building2, MapPin } from "lucide-react";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "branches";
  return (
    <MergedModuleTabs
      defaultValue="branches"
      items={[
        { value: "branches", label: "الفروع", icon: MapPin, content: activeTab === "branches" ? <ModulePageBody resourceKey="branches" query={query} showModuleTabs={false} /> : null },
        { value: "hospitals", label: "المستشفيات", icon: Building2, content: <HospitalsClient /> }
      ]}
    />
  );
}
