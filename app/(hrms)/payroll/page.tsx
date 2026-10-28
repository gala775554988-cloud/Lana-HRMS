import Link from "next/link";
import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { PayrollRunManager } from "@/components/enterprise/payroll-run-manager";
import { PayrollDashboard } from "@/components/enterprise/payroll-dashboard";
import { PayrollActivityFeed } from "@/components/enterprise/payroll-activity-feed";
import {
  LayoutDashboard,
  DollarSign,
  MinusCircle,
  PlusCircle,
  Receipt,
  CalendarRange,
  Building2,
  Gift,
  ListChecks,
} from "lucide-react";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "dashboard";
  return (
    <div className="space-y-6" dir="rtl">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-[10px] tracking-widest text-blue-200/70">
              الرواتب والاستحقاقات
            </p>
            <h1 className="text-2xl font-bold">المساحة المالية للموظفين</h1>
            <p className="mt-3 max-w-xl text-xs leading-6 text-blue-100/75">
              نظرة منظمة على المسيرات والمستحقات، مع وصول مباشر للفترات وكشوف
              الرواتب.
            </p>
          </div>
          <Link
            href="/payroll?tab=payroll-run"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-indigo-950 shadow-sm hover:bg-blue-50"
          >
            <DollarSign className="h-4 w-4" />
            فتح مسير الرواتب
          </Link>
        </div>
        <nav
          aria-label="اختصارات الرواتب"
          className="mt-6 flex flex-wrap gap-2"
        >
          {[
            ["payroll-items", "كشوف الموظفين"],
            ["payroll-periods", "فترات الرواتب"],
            ["payroll-runs", "سجل المسيرات"],
          ].map(([tab, label]) => (
            <Link
              key={tab}
              href={`/payroll?tab=${tab}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] text-blue-100 transition hover:bg-white/10"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <MergedModuleTabs
        defaultValue="dashboard"
        items={[
          {
            value: "dashboard",
            label: "لوحة المعلومات",
            icon: <LayoutDashboard className="h-4 w-4" />,
            content: activeTab === "dashboard" ? <PayrollDashboard /> : null,
          },
          {
            value: "payroll-run",
            label: "مسير الرواتب",
            icon: <DollarSign className="h-4 w-4" />,
            content: activeTab === "payroll-run" ? <PayrollRunManager /> : null,
          },
          {
            value: "payroll-periods",
            label: "الفترات",
            icon: <CalendarRange className="h-4 w-4" />,
            content:
              activeTab === "payroll-periods" ? (
                <ModulePageBody
                  resourceKey="payroll-periods"
                  query={query}
                  showModuleTabs={false}
                  tabValue="payroll-periods"
                />
              ) : null,
          },
          {
            value: "payroll-cost-centers",
            label: "مراكز التكلفة",
            icon: <Building2 className="h-4 w-4" />,
            content:
              activeTab === "payroll-cost-centers" ? (
                <ModulePageBody
                  resourceKey="payroll-cost-centers"
                  query={query}
                  showModuleTabs={false}
                  tabValue="payroll-cost-centers"
                />
              ) : null,
          },
          {
            value: "payroll-runs",
            label: "سجل المسيرات",
            icon: <DollarSign className="h-4 w-4" />,
            content:
              activeTab === "payroll-runs" ? (
                <ModulePageBody
                  resourceKey="payroll-runs"
                  query={query}
                  showModuleTabs={false}
                  tabValue="payroll-runs"
                />
              ) : null,
          },
          {
            value: "payroll-items",
            label: "بنود الرواتب",
            icon: <Receipt className="h-4 w-4" />,
            content:
              activeTab === "payroll-items" ? (
                <ModulePageBody
                  resourceKey="payroll-items"
                  query={query}
                  showModuleTabs={false}
                  tabValue="payroll-items"
                />
              ) : null,
          },
          {
            value: "allowances",
            label: "البدلات",
            icon: <PlusCircle className="h-4 w-4" />,
            content:
              activeTab === "allowances" ? (
                <ModulePageBody
                  resourceKey="allowances"
                  query={query}
                  showModuleTabs={false}
                  tabValue="allowances"
                />
              ) : null,
          },
          {
            value: "deductions",
            label: "الاستقطاعات",
            icon: <MinusCircle className="h-4 w-4" />,
            content:
              activeTab === "deductions" ? (
                <ModulePageBody
                  resourceKey="deductions"
                  query={query}
                  showModuleTabs={false}
                  tabValue="deductions"
                />
              ) : null,
          },
          {
            value: "bonuses",
            label: "المكافآت والعمولات",
            icon: <Gift className="h-4 w-4" />,
            content:
              activeTab === "bonuses" ? (
                <ModulePageBody
                  resourceKey="bonuses"
                  query={query}
                  showModuleTabs={false}
                  tabValue="bonuses"
                />
              ) : null,
          },
          {
            value: "activity",
            label: "سجل النشاط",
            icon: <ListChecks className="h-4 w-4" />,
            content: activeTab === "activity" ? <PayrollActivityFeed /> : null,
          },
        ]}
      />
    </div>
  );
}
