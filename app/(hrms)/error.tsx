"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { parseClientError } from "@/lib/errors";
import type { StructuredError } from "@/lib/errors";

export default function HrmsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [structuredError, setStructuredError] = useState<StructuredError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      setStructuredError(parseClientError(error, "app/(hrms)/"));
    }
  }, [error]);

  const handleCopy = () => {
    if (!structuredError) return;
    const text = [
      `رقم المرجع: ${structuredError.id}`,
      `نوع الخطأ: ${structuredError.name}`,
      `التصنيف: ${structuredError.category}`,
      `الرسالة: ${structuredError.message}`,
      structuredError.cause ? `السبب: ${structuredError.cause}` : "",
      structuredError.suggestion ? `الحل: ${structuredError.suggestion}` : "",
      error.digest ? `Digest: ${error.digest}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const err = structuredError || {
    id: "ERR-UNKNOWN",
    category: "unknown" as const,
    name: "Error",
    message: error.message || "The HRMS workspace could not load this view.",
    cause: undefined,
    suggestion: "أعد تحميل الصفحة أو حاول مرة أخرى",
  };

  const isUnlinkedOrAuthError = error?.message?.includes("not linked") || error?.message?.includes("Unauthorized") || error?.message?.includes("Forbidden");

  const handleSignOutAndPurge = async () => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    } catch {}
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
    <section className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-xl border bg-background p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">حدث خطأ</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{err.name}</p>
          </div>
        </div>

        {/* Message */}
        <div className="rounded-lg bg-muted/50 p-3 mb-4">
          <p className="text-sm text-foreground">{err.message}</p>
        </div>

        {isUnlinkedOrAuthError ? (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 mb-4 space-y-3" dir="rtl">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>حسابك غير مربوط ببطاقة موظف أو يحمل جلسة قديمة</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              بسبب تحديث قاعدة بيانات النظام (Neon PostgreSQL)، قد تكون بيانات الجلسة المخزنة في متصفحك تشير إلى هيكل قديم. اضغط على زر مسح الجلسة بالأسفل لإعادة الدخول النظيف.
            </p>
            <Button onClick={handleSignOutAndPurge} className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 text-xs h-10">
              <LogOut className="h-4 w-4" />
              <span>مسح الجلسة وتسجيل الخروج النظيف (Sign out & Clear Cookies)</span>
            </Button>
          </div>
        ) : null}

        {/* Cause */}
        {err.cause && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">السبب</p>
            <p className="text-sm text-foreground">{err.cause}</p>
          </div>
        )}

        {/* Suggestion */}
        {err.suggestion && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 mb-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">💡 الحل المقترح</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{err.suggestion}</p>
          </div>
        )}

        {/* Digest */}
        {error.digest && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">Server Digest: <code className="font-mono">{error.digest}</code></p>
          </div>
        )}

        {/* Reference */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <p className="text-[10px] text-muted-foreground">رقم مرجعي</p>
            <p className="text-xs font-mono font-bold">{err.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "تم النسخ" : "نسخ"}
            </Button>
            <Button size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة المحاولة
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href="/analytics"><Home className="h-3.5 w-3.5" />الرئيسية</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
