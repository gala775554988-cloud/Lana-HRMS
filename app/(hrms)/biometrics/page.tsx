import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { WorkspaceHeader } from "@/components/hrms/workspace-ui";
import { Suspense } from "react";
import { listAttendanceSites } from "@/lib/attendance/sites";
import { AttendanceSitesClient } from "@/components/hrms/AttendanceSitesClient";
import { BiometricLogsBody } from "@/components/hrms/biometric-logs-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Fingerprint, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BiometricsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles || [];
  const permissions = session.user.permissions || [];
  const canManageSites = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || permissions.includes("manage:settings") || hasPermission(permissions, { action: "manage", resource: "attendance" }, roles);
  const query = await searchParams;
  const activeTab = query.tab === "attendance-sites" ? "attendance-sites" : "biometric-logs";
  if (activeTab === "attendance-sites" && !canManageSites) redirect("/biometrics");
  const sites = activeTab === "attendance-sites" ? await listAttendanceSites() : [];
  return (
    <div className="space-y-5" dir="rtl">
    <WorkspaceHeader title="مراقبة البصمة ومواقع الحضور" description="متابعة سجلات أجهزة الحضور وجودة البيانات، وإدارة مواقع التسجيل المسموح بها." />
    <MergedModuleTabs
      defaultValue="biometric-logs"
      items={[
        {
          value: "biometric-logs",
          label: "مراقبة السجلات",
          icon: <Fingerprint className="h-4 w-4" />,
          content: activeTab === "biometric-logs" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جاري التحميل...</div>}>
              <BiometricLogsBody />
            </Suspense>
          ) : null
        },
        { value: "attendance-sites", hidden: !canManageSites, label: "مواقع الحضور", icon: <MapPin className="h-4 w-4" />, content: activeTab === "attendance-sites" ? <AttendanceSitesClient initialSites={sites} /> : null }
      ]}
    />
    </div>
  );
}
