import type { ReactNode } from "react";
import Link from "next/link";
import { getRequestDictionary } from "@/lib/i18n-server";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { locale } = await getRequestDictionary();

  return (
    <div className="space-y-4">
      <nav aria-label={locale === "ar" ? "التنقل في الحساب" : "Account navigation"}>
        <Link className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary/10" href="/employee/settings">
          {locale === "ar" ? "إعدادات حسابي" : "My account settings"}
        </Link>
      </nav>
      {children}
    </div>
  );
}
