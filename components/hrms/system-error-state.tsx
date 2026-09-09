"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Home, LogOut, RefreshCw } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SystemErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reference = error.digest;
  const isSessionError = /unauthorized|forbidden|session|cookie|not linked/i.test(error.message || "");

  useEffect(() => {
    fetch("/api/internal/report-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        digest: error.digest,
        message: error.message,
        name: error.name,
        path: typeof window !== "undefined" ? window.location.pathname : undefined
      })
    }).catch(() => {});
  }, [error]);

  const restartSession = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center p-5" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">تعذر إكمال العملية</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          حدث خطأ غير متوقع. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع مسؤول النظام.
        </p>
        {reference ? <p className="mt-3 text-xs text-muted-foreground">الرقم المرجعي: <code dir="ltr">{reference}</code></p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset} className="gap-2"><RefreshCw className="h-4 w-4" />إعادة المحاولة</Button>
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
