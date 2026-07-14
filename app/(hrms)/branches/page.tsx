import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Building2, MapPin } from "lucide-react";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "departments";
  return (
    <MergedModuleTabs
      defaultValue="departments"
      items={[
        { value: "departments", label: "الإدارات", icon: <Building2 className="h-4 w-4" />, content: activeTab === "departments" ? <ModulePageBody resourceKey="departments" query={query} showModuleTabs={false} tabValue="departments" /> : null },
        { value: "branches", label: "الفروع", icon: <MapPin className="h-4 w-4" />, content: activeTab === "branches" ? <ModulePageBody resourceKey="branches" query={query} showModuleTabs={false} tabValue="branches" /> : null }
      ]}
    />
  );
}
