"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseClientError } from "@/lib/errors";
import type { StructuredError } from "@/lib/errors";

export default function ModuleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [structuredError, setStructuredError] = useState<StructuredError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      setStructuredError(parseClientError(error, "app/(hrms)/[module]/"));
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
    id: "ERR-MODULE-UNKNOWN",
    category: "unknown" as const,
    name: "Module Error",
    message: error.message || "حدث خطأ أثناء تحميل هذه الوحدة",
    cause: undefined,
    suggestion: "أعد تحميل الصفحة أو حاول مرة أخرى",
  };

  return (
    <section className="flex min-h-[60vh] items-center justify-center p-4" dir="rtl">
      <div className="max-w-lg w-full rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">خطأ في تحميل الوحدة</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{err.name}</p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 mb-4">
          <p className="text-sm text-foreground">{err.message}</p>
        </div>

        {err.cause && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">السبب</p>
            <p className="text-sm text-foreground">{err.cause}</p>
          </div>
        )}

        {err.suggestion && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 mb-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">💡 الحل المقترح</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{err.suggestion}</p>
          </div>
        )}

        {error.digest && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">Server Digest: <code className="font-mono">{error.digest}</code></p>
          </div>
        )}

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
              <a href="/dashboard"><Home className="h-3.5 w-3.5" />الرئيسية</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
