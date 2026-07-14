import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Briefcase, Globe2, Tag } from "lucide-react";

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "positions";
  return (
    <MergedModuleTabs
      defaultValue="positions"
      items={[
        { value: "positions", label: "المناصب", icon: <Briefcase className="h-4 w-4" />, content: activeTab === "positions" ? <ModulePageBody resourceKey="positions" query={query} showModuleTabs={false} tabValue="positions" /> : null },
        { value: "employment-types", label: "أنواع التوظيف", icon: <Tag className="h-4 w-4" />, content: activeTab === "employment-types" ? <ModulePageBody resourceKey="employment-types" query={query} showModuleTabs={false} tabValue="employment-types" /> : null },
        { value: "nationalities", label: "الجنسيات", icon: <Globe2 className="h-4 w-4" />, content: activeTab === "nationalities" ? <ModulePageBody resourceKey="nationalities" query={query} showModuleTabs={false} tabValue="nationalities" /> : null }
      ]}
    />
  );
}
