import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { CalendarClock, CalendarRange } from "lucide-react";

export default async function ShiftsManagementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="shifts"
      items={[
        { value: "shifts", label: "الورديات", icon: CalendarClock, content: <ModulePageBody resourceKey="shifts" query={query} showModuleTabs={false} tabValue="shifts" /> },
        { value: "shift-assignments", label: "جدول المناوبات", icon: CalendarRange, content: <ModulePageBody resourceKey="shift-assignments" query={query} showModuleTabs={false} tabValue="shift-assignments" /> }
      ]}
    />
  );
}
