import type { ReactNode } from "react";
import { AppShell } from "@/components/hrms/app-shell";
import { getCompanyLogo } from "@/lib/settings";
import { TopLoader } from "@/components/ui/top-loader";
import { getRequestDictionary } from "@/lib/i18n-server";

export default async function HrmsLayout({ children }: { children: ReactNode }) {
  const [logo, { locale, dictionary }] = await Promise.all([
    getCompanyLogo().catch(() => null),
    getRequestDictionary()
  ]);

  return (
    <>
      <TopLoader />
      <AppShell companyLogo={logo} locale={locale} dictionary={dictionary}>{children}</AppShell>
    </>
  );
}
