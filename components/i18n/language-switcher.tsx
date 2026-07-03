"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { defaultLocale, getLocaleFromPath, stripLocaleFromPath, withLocale, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({
  locale,
  variant = "outline",
  className
}: {
  locale: Locale;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale: Locale = locale === "ar" ? "en" : "ar";

  function switchLanguage() {
    const currentLocale = getLocaleFromPath(pathname);
    const nextPath = currentLocale ? withLocale(stripLocaleFromPath(pathname), nextLocale) : stripLocaleFromPath(pathname || "/");
    document.cookie = `lana-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem("lana.hrms.locale", nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
    router.replace(nextPath || (nextLocale === defaultLocale ? "/" : `/${nextLocale}`));
    router.refresh();
  }

  return (
    <Button type="button" variant={variant} size="sm" onClick={switchLanguage} className={className} aria-label="Switch language">
      <Languages className="me-2 h-4 w-4" aria-hidden="true" />
      {nextLocale === "ar" ? "العربية" : "English"}
    </Button>
  );
}
