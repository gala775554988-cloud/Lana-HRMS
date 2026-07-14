import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { SystemSettingsBody } from "@/components/hrms/system-settings-body";
import { Settings, SlidersHorizontal } from "lucide-react";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="general"
      items={[
        { value: "general", label: "الإعدادات العامة", icon: Settings, content: <SystemSettingsBody /> },
        { value: "all-settings", label: "كل الإعدادات", icon: SlidersHorizontal, content: <ModulePageBody resourceKey="settings" query={query} showModuleTabs={false} tabValue="all-settings" /> }
      ]}
    />
  );
}
