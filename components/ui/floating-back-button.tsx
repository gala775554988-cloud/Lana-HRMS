"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const storageKey = "lana.navigation.trail";
function isInternalPage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/^\/(login|logout|api|force-change-password)(\/|$)/.test(value);
}

export function FloatingBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [previous, setPrevious] = useState<string | null>(null);
  useEffect(() => {
    if (!isInternalPage(pathname)) return;
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      const trail: string[] = Array.isArray(parsed) ? parsed.filter(isInternalPage).slice(-30) : [];
      if (trail.at(-1) !== pathname) {
        if (trail.at(-2) === pathname) trail.pop();
        else trail.push(pathname);
      }
      setPrevious(trail.at(-2) || null);
      sessionStorage.setItem(storageKey, JSON.stringify(trail));
    } catch { setPrevious(null); }
  }, [pathname]);

  if (!isInternalPage(pathname) || pathname === "/") return null;
  const parent = pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  const target = previous || (parent ? `/${parent}` : "/");
  return <button type="button" className="lana-back-control" aria-label="الرجوع إلى الصفحة السابقة" title="الرجوع" onClick={() => router.push(target)} dir="ltr">
    <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
    <span className="lana-back-label" dir="rtl">الرجوع</span>
  </button>;
}
