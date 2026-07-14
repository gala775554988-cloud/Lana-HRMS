import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { HospitalsClient } from "@/components/hrms/hospitals-client";
import { Building2, MapPin } from "lucide-react";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="branches"
      items={[
        { value: "branches", label: "الفروع", icon: MapPin, content: <ModulePageBody resourceKey="branches" query={query} showModuleTabs={false} /> },
        { value: "hospitals", label: "المستشفيات", icon: Building2, content: <HospitalsClient /> }
      ]}
    />
  );
}
