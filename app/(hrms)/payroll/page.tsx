import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { DollarSign, MinusCircle, PlusCircle, Receipt } from "lucide-react";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <MergedModuleTabs
      defaultValue="payroll-runs"
      items={[
        { value: "payroll-runs", label: "مسيرات الرواتب", icon: DollarSign, content: <ModulePageBody resourceKey="payroll-runs" query={query} showModuleTabs={false} tabValue="payroll-runs" /> },
        { value: "payroll-items", label: "بنود الرواتب", icon: Receipt, content: <ModulePageBody resourceKey="payroll-items" query={query} showModuleTabs={false} tabValue="payroll-items" /> },
        { value: "allowances", label: "البدلات", icon: PlusCircle, content: <ModulePageBody resourceKey="allowances" query={query} showModuleTabs={false} tabValue="allowances" /> },
        { value: "deductions", label: "الاستقطاعات", icon: MinusCircle, content: <ModulePageBody resourceKey="deductions" query={query} showModuleTabs={false} tabValue="deductions" /> }
      ]}
    />
  );
}
