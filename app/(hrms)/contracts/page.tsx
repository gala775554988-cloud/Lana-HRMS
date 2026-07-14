import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { FileText, FolderOpen } from "lucide-react";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "contracts";
  return (
    <MergedModuleTabs
      defaultValue="contracts"
      items={[
        { value: "contracts", label: "العقود", icon: FileText, content: activeTab === "contracts" ? <ModulePageBody resourceKey="contracts" query={query} showModuleTabs={false} tabValue="contracts" /> : null },
        { value: "documents", label: "المستندات", icon: FolderOpen, content: activeTab === "documents" ? <ModulePageBody resourceKey="documents" query={query} showModuleTabs={false} tabValue="documents" /> : null }
      ]}
    />
  );
}
