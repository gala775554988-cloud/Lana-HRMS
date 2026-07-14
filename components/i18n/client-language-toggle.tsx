"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeLocale, type Locale } from "@/lib/i18n";

function readLocale(): Locale {
  if (typeof window === "undefined") return "ar";
  const cookie = document.cookie.match(/(?:^|; )lana-locale=([^;]+)/)?.[1];
  return normalizeLocale(window.localStorage.getItem("lana.hrms.locale") ?? (cookie ? decodeURIComponent(cookie) : null) ?? document.documentElement.lang);
}

export function ClientLanguageToggle({
  variant = "ghost",
  className,
  icon = "languages"
}: {
  variant?: "outline" | "ghost";
  className?: string;
  icon?: "languages" | "globe";
}) {
  const [locale, setLocale] = useState<Locale>("ar");
  const router = useRouter();

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  const nextLocale: Locale = locale === "ar" ? "en" : "ar";
  const Icon = icon === "globe" ? Globe : Languages;

  function switchLanguage() {
    document.cookie = `lana-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem("lana.hrms.locale", nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
    setLocale(nextLocale);
    window.dispatchEvent(new CustomEvent("lana-locale-change", { detail: { locale: nextLocale } }));
    // Re-render server components (app shell nav, dashboard) that now read
    // the locale cookie directly via getRequestDictionary(), in addition to
    // the DOM-rewrite runtime that still covers everything not yet converted.
    router.refresh();
  }

  return (
    <Button type="button" variant={variant} size="sm" onClick={switchLanguage} className={className} aria-label={nextLocale === "ar" ? "تغيير إلى العربية" : "Switch to English"}>
      <Icon className="me-2 h-4 w-4" aria-hidden="true" />
      {nextLocale === "ar" ? "العربية" : "English"}
    </Button>
  );
}
