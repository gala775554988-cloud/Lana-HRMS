import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { ModulePageBody } from "@/components/hrms/module-page-body";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Bell, Megaphone } from "lucide-react";

const NotificationCenterClient = dynamicImport(() => import("@/components/enterprise/notification-center-client").then((mod) => mod.NotificationCenterClient));

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "announcements";
  return (
    <MergedModuleTabs
      defaultValue="announcements"
      items={[
        { value: "announcements", label: "الإعلانات", icon: Megaphone, content: activeTab === "announcements" ? <ModulePageBody resourceKey="announcements" query={query} showModuleTabs={false} tabValue="announcements" /> : null },
        {
          value: "notifications",
          label: "الإشعارات",
          icon: Bell,
          content: (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading notifications...</div>}>
              <NotificationCenterClient />
            </Suspense>
          )
        }
      ]}
    />
  );
}
