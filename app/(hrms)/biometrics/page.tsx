import { Suspense } from "react";
import { listAttendanceSites } from "@/lib/attendance/sites";
import { AttendanceSitesClient } from "@/components/hrms/AttendanceSitesClient";
import { BiometricLogsBody } from "@/components/hrms/biometric-logs-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Fingerprint, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BiometricsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "biometric-logs";
  const sites = activeTab === "attendance-sites" ? await listAttendanceSites() : [];
  return (
    <MergedModuleTabs
      defaultValue="biometric-logs"
      items={[
        {
          value: "biometric-logs",
          label: "سجلات البصمة",
          icon: <Fingerprint className="h-4 w-4" />,
          content: activeTab === "biometric-logs" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جاري التحميل...</div>}>
              <BiometricLogsBody />
            </Suspense>
          ) : null
        },
        { value: "attendance-sites", label: "مواقع الحضور", icon: <MapPin className="h-4 w-4" />, content: activeTab === "attendance-sites" ? <AttendanceSitesClient initialSites={sites} /> : null }
      ]}
    />
  );
}
