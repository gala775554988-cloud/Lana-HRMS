import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Calendar, ListChecks } from "lucide-react";

export default async function LeavePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "leave-requests";
  return (
    <MergedModuleTabs
      defaultValue="leave-requests"
      items={[
        { value: "leave-requests", label: "طلبات الإجازات", icon: Calendar, content: activeTab === "leave-requests" ? <ModulePageBody resourceKey="leave-requests" query={query} showModuleTabs={false} tabValue="leave-requests" /> : null },
        { value: "leave-types", label: "أنواع الإجازات", icon: ListChecks, content: activeTab === "leave-types" ? <ModulePageBody resourceKey="leave-types" query={query} showModuleTabs={false} tabValue="leave-types" /> : null }
      ]}
    />
  );
}
