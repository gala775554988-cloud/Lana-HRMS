import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { PayrollRunManager } from "@/components/enterprise/payroll-run-manager";
import { DollarSign, MinusCircle, PlusCircle, Receipt, CalendarRange, Building2, Gift } from "lucide-react";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "payroll-run";
  return (
    <MergedModuleTabs
      defaultValue="payroll-run"
      items={[
        { value: "payroll-run", label: "مسير الرواتب", icon: <DollarSign className="h-4 w-4" />, content: activeTab === "payroll-run" ? <PayrollRunManager /> : null },
        { value: "payroll-periods", label: "الفترات", icon: <CalendarRange className="h-4 w-4" />, content: activeTab === "payroll-periods" ? <ModulePageBody resourceKey="payroll-periods" query={query} showModuleTabs={false} tabValue="payroll-periods" /> : null },
        { value: "payroll-cost-centers", label: "مراكز التكلفة", icon: <Building2 className="h-4 w-4" />, content: activeTab === "payroll-cost-centers" ? <ModulePageBody resourceKey="payroll-cost-centers" query={query} showModuleTabs={false} tabValue="payroll-cost-centers" /> : null },
        { value: "payroll-runs", label: "سجل المسيرات", icon: <DollarSign className="h-4 w-4" />, content: activeTab === "payroll-runs" ? <ModulePageBody resourceKey="payroll-runs" query={query} showModuleTabs={false} tabValue="payroll-runs" /> : null },
        { value: "payroll-items", label: "بنود الرواتب", icon: <Receipt className="h-4 w-4" />, content: activeTab === "payroll-items" ? <ModulePageBody resourceKey="payroll-items" query={query} showModuleTabs={false} tabValue="payroll-items" /> : null },
        { value: "allowances", label: "البدلات", icon: <PlusCircle className="h-4 w-4" />, content: activeTab === "allowances" ? <ModulePageBody resourceKey="allowances" query={query} showModuleTabs={false} tabValue="allowances" /> : null },
        { value: "deductions", label: "الاستقطاعات", icon: <MinusCircle className="h-4 w-4" />, content: activeTab === "deductions" ? <ModulePageBody resourceKey="deductions" query={query} showModuleTabs={false} tabValue="deductions" /> : null },
        { value: "bonuses", label: "المكافآت والعمولات", icon: <Gift className="h-4 w-4" />, content: activeTab === "bonuses" ? <ModulePageBody resourceKey="bonuses" query={query} showModuleTabs={false} tabValue="bonuses" /> : null }
      ]}
    />
  );
}
