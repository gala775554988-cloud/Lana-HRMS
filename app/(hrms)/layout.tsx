import type { ReactNode } from "react";
import { AppShell } from "@/components/hrms/app-shell";
import { getCompanyLogo } from "@/lib/settings";
import { TopLoader } from "@/components/ui/top-loader";

export default async function HrmsLayout({ children }: { children: ReactNode }) {
  const logo = await getCompanyLogo().catch(() => null);
  
  return (
    <>
      <TopLoader />
      <AppShell companyLogo={logo}>{children}</AppShell>
    </>
  );
}
