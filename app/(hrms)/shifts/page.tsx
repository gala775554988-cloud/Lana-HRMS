import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { CalendarClock, CalendarRange } from "lucide-react";

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "shifts";
  return (
    <MergedModuleTabs
      defaultValue="shifts"
      items={[
        { value: "shifts", label: "الورديات", icon: <CalendarClock className="h-4 w-4" />, content: activeTab === "shifts" ? <ModulePageBody resourceKey="shifts" query={query} showModuleTabs={false} tabValue="shifts" /> : null },
        { value: "shift-assignments", label: "جدول المناوبات", icon: <CalendarRange className="h-4 w-4" />, content: activeTab === "shift-assignments" ? <ModulePageBody resourceKey="shift-assignments" query={query} showModuleTabs={false} tabValue="shift-assignments" /> : null }
      ]}
    />
  );
}
