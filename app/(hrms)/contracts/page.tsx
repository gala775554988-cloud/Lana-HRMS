import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { FileText, FolderOpen } from "lucide-react";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="contracts"
      items={[
        { value: "contracts", label: "العقود", icon: FileText, content: <ModulePageBody resourceKey="contracts" query={query} showModuleTabs={false} tabValue="contracts" /> },
        { value: "documents", label: "المستندات", icon: FolderOpen, content: <ModulePageBody resourceKey="documents" query={query} showModuleTabs={false} tabValue="documents" /> }
      ]}
    />
  );
}
