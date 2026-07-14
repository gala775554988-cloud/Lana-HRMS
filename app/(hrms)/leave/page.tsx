import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Calendar, ListChecks } from "lucide-react";

export default async function LeavePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="leave-requests"
      items={[
        { value: "leave-requests", label: "طلبات الإجازات", icon: Calendar, content: <ModulePageBody resourceKey="leave-requests" query={query} showModuleTabs={false} tabValue="leave-requests" /> },
        { value: "leave-types", label: "أنواع الإجازات", icon: ListChecks, content: <ModulePageBody resourceKey="leave-types" query={query} showModuleTabs={false} tabValue="leave-types" /> }
      ]}
    />
  );
}
