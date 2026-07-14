import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { GraduationCap, ListChecks } from "lucide-react";

export default async function TrainingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="training"
      items={[
        { value: "training", label: "البرامج التدريبية", icon: GraduationCap, content: <ModulePageBody resourceKey="training" query={query} showModuleTabs={false} tabValue="training" /> },
        { value: "training-enrollments", label: "سجلات الالتحاق", icon: ListChecks, content: <ModulePageBody resourceKey="training-enrollments" query={query} showModuleTabs={false} tabValue="training-enrollments" /> }
      ]}
    />
  );
}
