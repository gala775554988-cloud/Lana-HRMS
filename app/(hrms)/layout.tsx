import type { ReactNode } from "react";
import { AppShell } from "@/components/hrms/app-shell";
import { getCompanyLogo } from "@/lib/settings";

export default async function HrmsLayout({ children }: { children: ReactNode }) {
  // Preload company logo (can be used in AppShell if extended)
  const logo = await getCompanyLogo().catch(() => null);
  
  return <AppShell companyLogo={logo}>{children}</AppShell>;
}
