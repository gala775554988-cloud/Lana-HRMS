import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Briefcase, Globe2, Tag } from "lucide-react";

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="positions"
      items={[
        { value: "positions", label: "المناصب", icon: Briefcase, content: <ModulePageBody resourceKey="positions" query={query} showModuleTabs={false} tabValue="positions" /> },
        { value: "employment-types", label: "أنواع التوظيف", icon: Tag, content: <ModulePageBody resourceKey="employment-types" query={query} showModuleTabs={false} tabValue="employment-types" /> },
        { value: "nationalities", label: "الجنسيات", icon: Globe2, content: <ModulePageBody resourceKey="nationalities" query={query} showModuleTabs={false} tabValue="nationalities" /> }
      ]}
    />
  );
}
