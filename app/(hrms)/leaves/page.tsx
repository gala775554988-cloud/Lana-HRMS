import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { LeaveDashboard } from "@/components/enterprise/leave-dashboard";
import { LeaveCalendar } from "@/components/enterprise/leave-calendar";
import { LeaveAbsenteeReport } from "@/components/enterprise/leave-absentee-report";
import { LeaveReports } from "@/components/enterprise/leave-reports";
import { LayoutDashboard, Calendar, CalendarDays, UserX, BarChart3, ListChecks } from "lucide-react";

export default async function LeavesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "dashboard";
  return (
    <MergedModuleTabs
      defaultValue="dashboard"
      items={[
        { value: "dashboard", label: "لوحة المعلومات", icon: <LayoutDashboard className="h-4 w-4" />, content: activeTab === "dashboard" ? <LeaveDashboard /> : null },
        { value: "leave-requests", label: "طلبات الإجازات", icon: <Calendar className="h-4 w-4" />, content: activeTab === "leave-requests" ? <ModulePageBody resourceKey="leave-requests" query={query} showModuleTabs={false} tabValue="leave-requests" /> : null },
        { value: "leave-types", label: "أنواع الإجازات", icon: <ListChecks className="h-4 w-4" />, content: activeTab === "leave-types" ? <ModulePageBody resourceKey="leave-types" query={query} showModuleTabs={false} tabValue="leave-types" /> : null },
        { value: "calendar", label: "التقويم", icon: <CalendarDays className="h-4 w-4" />, content: activeTab === "calendar" ? <LeaveCalendar /> : null },
        { value: "absentee", label: "كشف الغائبين", icon: <UserX className="h-4 w-4" />, content: activeTab === "absentee" ? <LeaveAbsenteeReport /> : null },
        { value: "reports", label: "التقارير", icon: <BarChart3 className="h-4 w-4" />, content: activeTab === "reports" ? <LeaveReports /> : null }
      ]}
    />
  );
}
