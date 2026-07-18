"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { parseClientError } from "@/lib/errors";
import type { StructuredError } from "@/lib/errors";

/**
 * Global Root Error Boundary (`app/error.tsx`)
 * --------------------------------------------
 * Catches unhandled runtime errors across the root application layout and dashboard.
 * Includes automatic session validity detection and an explicit
 * "Sign out & Clear Cookies" button when stale Neon migration cookies or unlinked employee cards occur.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [structuredError, setStructuredError] = useState<StructuredError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      setStructuredError(parseClientError(error, "app/"));
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
    message: error.message || "حدث خطأ حرج أثناء تحميل شاشة النظام",
    cause: undefined,
    suggestion: "أعد تحميل الصفحة أو حاول تنظيف الجلسة والدخول مجدداً",
  };

  const isUnlinkedOrAuthError =
    error?.message?.includes("not linked") ||
    error?.message?.includes("Unauthorized") ||
    error?.message?.includes("Forbidden") ||
    error?.message?.includes("session") ||
    error?.message?.includes("cookie");

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
    <section className="flex min-h-[75vh] items-center justify-center p-4 bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="max-w-lg w-full rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-xs">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground">حدث خطأ في النظام</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{err.name}</p>
          </div>
        </div>

        {/* Message */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-3.5 mb-4 border border-slate-200/60 dark:border-slate-800">
          <p className="text-sm font-bold text-foreground leading-relaxed">{err.message}</p>
        </div>

        {/* Session Purge Warning Box */}
        {isUnlinkedOrAuthError ? (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 mb-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>حسابك غير مربوط ببطاقة موظف أو يحمل جلسة قديمة</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              بسبب نقل وتحديث قاعدة بيانات النظام إلى Neon PostgreSQL، قد تكون ملفات تعريف الارتباط (Cookies) وبيانات الجلسة الحالية تشير إلى هيكل قديم. اضغط على زر مسح الجلسة بالأسفل لإعادة الدخول النظيف.
            </p>
            <Button onClick={handleSignOutAndPurge} className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 text-xs h-11 shadow-sm">
              <LogOut className="h-4 w-4" />
              <span>مسح الجلسة وتسجيل الخروج النظيف (Sign out & Clear Cookies)</span>
            </Button>
          </div>
        ) : null}

        {/* Cause */}
        {err.cause && (
          <div className="mb-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">السبب المحتمل</p>
            <p className="text-sm text-foreground">{err.cause}</p>
          </div>
        )}

        {/* Suggestion */}
        {err.suggestion && !isUnlinkedOrAuthError && (
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 mb-4">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">💡 الحل المقترح</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{err.suggestion}</p>
          </div>
        )}

        {/* Digest */}
        {error.digest && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">Server Digest: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{error.digest}</code></p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[10px] text-muted-foreground">رقم مرجعي</p>
            <p className="text-xs font-mono font-bold">{err.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs rounded-xl">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "تم النسخ" : "نسخ"}
            </Button>
            <Button size="sm" onClick={reset} className="gap-1.5 text-xs rounded-xl bg-primary hover:bg-primary text-white font-bold">
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة المحاولة
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs rounded-xl">
              <a href="/login"><Home className="h-3.5 w-3.5" />تسجيل الدخول</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
