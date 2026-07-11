import type { ReactNode } from "react";
import { AppShell } from "@/components/hrms/app-shell";
import { getCompanyLogo } from "@/lib/settings";
import { TopLoader } from "@/components/ui/top-loader";

export const dynamic = "force-dynamic";

export default async function HrmsLayout({ children }: { children: ReactNode }) {
  // Preload company logo (can be used in AppShell if extended)
  const logo = await getCompanyLogo().catch(() => null);
  console.log("[LAYOUT_TRACE]", {
    currentLayout: "app/(hrms)/layout.tsx",
    currentRoute: "HRMS route group",
    currentSidebarComponent: "components/hrms/app-shell.tsx",
    currentDashboardComponent: "app/(hrms)/dashboard/page.tsx when /dashboard is requested"
  });
  
  return (
    <>
      <TopLoader />
      <AppShell companyLogo={logo}>{children}</AppShell>
    </>
  );
}
