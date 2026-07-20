"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2, LogOut, Code, FileCode } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Forbidden403 } from "@/components/hrms/forbidden-403";

export default function EmployeePortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false);

  const rawMessage = error.message || "Unknown runtime error";
  const digest = error.digest || "N/A";
  const stack = error.stack || "";

  if (rawMessage === "Forbidden") return <Forbidden403 />;

  const handleCopy = () => {
    const text = [
      `== اعتراف النظام بالخطأ التقني (Employee Portal Diagnostic Confession) ==`,
      `رسالة الخطأ: ${rawMessage}`,
      `الرقم المرجعي (Digest): ${digest}`,
      stack ? `مسار الخطأ (Stack Trace):\n${stack}` : "",
    ].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isUnlinkedOrAuthError =
    rawMessage.includes("not linked") ||
    rawMessage.includes("Unauthorized") ||
    rawMessage.includes("Forbidden") ||
    rawMessage.includes("session") ||
    rawMessage.includes("cookie");

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
    <section className="flex min-h-[80vh] items-center justify-center p-4 bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="max-w-2xl w-full rounded-3xl border border-rose-200 bg-white p-8 shadow-2xl dark:border-rose-900/80 dark:bg-slate-900">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30">
            <AlertTriangle className="h-7 w-7 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">اعتراف النظام بالخطأ التقني المباشر</h1>
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                Employee Portal Error
              </span>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-bold">
              تم التقاط هذا الاستثناء برمجياً لبيان سبب ومكان الانهيار بدقة
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 mb-5 space-y-3 dark:border-rose-900/60 dark:bg-rose-950/40 font-mono text-xs">
          <div>
            <span className="font-bold text-rose-900 dark:text-rose-200 block mb-1 flex items-center gap-1.5">
              <Code className="h-4 w-4" />
              <span>الرسالة التقنية (Error Message):</span>
            </span>
            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-bold select-all overflow-x-auto">
              {rawMessage}
            </div>
          </div>

          {digest !== "N/A" && (
            <div>
              <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1">الرقم المرجعي للخادم (Server Digest):</span>
              <code className="p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold select-all inline-block">
                {digest}
              </code>
            </div>
          )}

          {stack && (
            <div>
              <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1 flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5" />
                <span>مسار التنفيذ والملف (Stack Trace):</span>
              </span>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] leading-relaxed overflow-x-auto max-h-56 select-all">
                {stack}
              </pre>
            </div>
          )}
        </div>

        {isUnlinkedOrAuthError ? (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 mb-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>حسابك غير مربوط ببطاقة موظف أو يحمل جلسة قديمة</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
              بسبب نقل وتحديث قاعدة بيانات النظام إلى Neon PostgreSQL، قد تكون ملفات تعريف الارتباط (Cookies) وبيانات الجلسة الحالية تشير إلى هيكل قديم. اضغط على زر مسح الجلسة بالأسفل لإعادة الدخول النظيف.
            </p>
            <Button onClick={handleSignOutAndPurge} className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 text-xs h-11 shadow-sm">
              <LogOut className="h-4 w-4" />
              <span>مسح الجلسة وتسجيل الخروج النظيف (Sign out & Clear Cookies)</span>
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700 h-10 px-4">
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
            {copied ? "تم نسخ التقرير التقني" : "نسخ تفاصيل الخطأ"}
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={reset} className="gap-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-white h-10 px-4 shadow-md">
              <RefreshCw className="h-4 w-4" />
              إعادة التحميل والمحاولة
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-2 text-xs font-bold rounded-xl h-10 px-4">
              <a href="/login"><Home className="h-4 w-4" />تسجيل الدخول</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
