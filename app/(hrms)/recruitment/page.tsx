import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Briefcase, UserPlus } from "lucide-react";

export default async function RecruitmentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "recruitment";
  return (
    <MergedModuleTabs
      defaultValue="recruitment"
      items={[
        { value: "recruitment", label: "الوظائف الشاغرة", icon: Briefcase, content: activeTab === "recruitment" ? <ModulePageBody resourceKey="recruitment" query={query} showModuleTabs={false} tabValue="recruitment" /> : null },
        { value: "candidates", label: "المرشحون", icon: UserPlus, content: activeTab === "candidates" ? <ModulePageBody resourceKey="candidates" query={query} showModuleTabs={false} tabValue="candidates" /> : null }
      ]}
    />
  );
}
