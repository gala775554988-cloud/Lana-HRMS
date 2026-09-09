"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Home, LogOut, RefreshCw } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SystemErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reference = error.digest;
  const isSessionError = /unauthorized|forbidden|session|cookie|not linked/i.test(error.message || "");
  const isStaleDeployment = /Server Action .* was not found|failed-to-find-server-action|ChunkLoadError|Loading chunk|failed to fetch dynamically imported module/i.test(error.message || "");
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!isStaleDeployment || typeof window === "undefined") return;

    const guardKey = "hrms.stale-deployment-recovery";
    const lastAttempt = Number(window.sessionStorage.getItem(guardKey) || 0);
    if (Date.now() - lastAttempt < 60_000) return;

    window.sessionStorage.setItem(guardKey, String(Date.now()));
    setIsRecovering(true);

    void (async () => {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith("hrms-") || name.startsWith("lana-hrms-"))
            .map((name) => caches.delete(name))
        );
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
      }

      const freshUrl = new URL(window.location.href);
      freshUrl.searchParams.set("_hrms_refresh", String(Date.now()));
      window.location.replace(freshUrl.toString());
    })().catch(() => window.location.reload());
  }, [isStaleDeployment]);

  const restartSession = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center p-5" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">{isStaleDeployment ? "يتوفر تحديث جديد للنظام" : "تعذر إكمال العملية"}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {isStaleDeployment
            ? isRecovering
              ? "جارٍ تحديث النظام تلقائيًا. ستعود إلى الصفحة خلال لحظات."
              : "يلزم تحديث الصفحة لإكمال العملية باستخدام أحدث إصدار."
            : "حدث خطأ غير متوقع. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع مسؤول النظام."}
        </p>
        {reference ? <p className="mt-3 text-xs text-muted-foreground">الرقم المرجعي: <code dir="ltr">{reference}</code></p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={isStaleDeployment ? () => window.location.reload() : reset} disabled={isRecovering} className="gap-2"><RefreshCw className={`h-4 w-4 ${isRecovering ? "animate-spin" : ""}`} />{isRecovering ? "جارٍ التحديث" : "إعادة المحاولة"}</Button>
          {isSessionError ? (
            <Button variant="outline" onClick={restartSession} className="gap-2"><LogOut className="h-4 w-4" />تسجيل الدخول مجددًا</Button>
          ) : (
            <Button variant="outline" asChild className="gap-2"><Link href="/"><Home className="h-4 w-4" />الصفحة الرئيسية</Link></Button>
          )}
        </div>
      </div>
    </section>
  );
}
