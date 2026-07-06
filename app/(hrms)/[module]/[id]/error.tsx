"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ArrowRight, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseClientError } from "@/lib/errors";
import type { StructuredError } from "@/lib/errors";

export default function RecordError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [structuredError, setStructuredError] = useState<StructuredError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      setStructuredError(parseClientError(error, "app/(hrms)/[module]/[id]/"));
    }
  }, [error]);

  const err = structuredError || {
    id: "ERR-RECORD-UNKNOWN",
    category: "unknown" as const,
    name: "Record Error",
    message: error.message || "حدث خطأ أثناء تحميل السجل",
    cause: undefined,
    suggestion: "أعد تحميل الصفحة أو عد إلى القائمة",
  };

  return (
    <section className="flex min-h-[60vh] items-center justify-center p-4" dir="rtl">
      <div className="max-w-lg w-full rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">خطأ في تحميل السجل</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{err.name}</p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 mb-4">
          <p className="text-sm text-foreground">{err.message}</p>
        </div>
        {err.suggestion && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 mb-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">💡 الحل المقترح</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{err.suggestion}</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs font-mono text-muted-foreground">{err.id}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={reset} className="gap-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" />إعادة المحاولة</Button>
            <Button variant="outline" size="sm" onClick={() => history.back()} className="gap-1.5 text-xs"><ArrowRight className="h-3.5 w-3.5" />رجوع</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
