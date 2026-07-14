import { Suspense } from "react";
import { listAttendanceSites } from "@/lib/attendance/sites";
import { AttendanceSitesClient } from "@/components/hrms/AttendanceSitesClient";
import { BiometricLogsBody } from "@/components/hrms/biometric-logs-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Fingerprint, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BiometricsPage() {
  const sites = await listAttendanceSites();
  return (
    <MergedModuleTabs
      defaultValue="biometric-logs"
      items={[
        {
          value: "biometric-logs",
          label: "سجلات البصمة",
          icon: Fingerprint,
          content: (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جاري التحميل...</div>}>
              <BiometricLogsBody />
            </Suspense>
          )
        },
        { value: "attendance-sites", label: "مواقع الحضور", icon: MapPin, content: <AttendanceSitesClient initialSites={sites} /> }
      ]}
    />
  );
}
