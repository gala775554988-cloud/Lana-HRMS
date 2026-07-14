import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { DollarSign, MinusCircle, PlusCircle, Receipt } from "lucide-react";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "payroll-runs";
  return (
    <MergedModuleTabs
      defaultValue="payroll-runs"
      items={[
        { value: "payroll-runs", label: "مسيرات الرواتب", icon: DollarSign, content: activeTab === "payroll-runs" ? <ModulePageBody resourceKey="payroll-runs" query={query} showModuleTabs={false} tabValue="payroll-runs" /> : null },
        { value: "payroll-items", label: "بنود الرواتب", icon: Receipt, content: activeTab === "payroll-items" ? <ModulePageBody resourceKey="payroll-items" query={query} showModuleTabs={false} tabValue="payroll-items" /> : null },
        { value: "allowances", label: "البدلات", icon: PlusCircle, content: activeTab === "allowances" ? <ModulePageBody resourceKey="allowances" query={query} showModuleTabs={false} tabValue="allowances" /> : null },
        { value: "deductions", label: "الاستقطاعات", icon: MinusCircle, content: activeTab === "deductions" ? <ModulePageBody resourceKey="deductions" query={query} showModuleTabs={false} tabValue="deductions" /> : null }
      ]}
    />
  );
}
