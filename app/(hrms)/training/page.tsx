import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { GraduationCap, ListChecks } from "lucide-react";

export default async function TrainingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "training";
  return (
    <MergedModuleTabs
      defaultValue="training"
      items={[
        { value: "training", label: "البرامج التدريبية", icon: <GraduationCap className="h-4 w-4" />, content: activeTab === "training" ? <ModulePageBody resourceKey="training" query={query} showModuleTabs={false} tabValue="training" /> : null },
        { value: "training-enrollments", label: "سجلات الالتحاق", icon: <ListChecks className="h-4 w-4" />, content: activeTab === "training-enrollments" ? <ModulePageBody resourceKey="training-enrollments" query={query} showModuleTabs={false} tabValue="training-enrollments" /> : null }
      ]}
    />
  );
}
