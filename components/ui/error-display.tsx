"use client";

import { AlertTriangle, RefreshCw, Copy, CheckCircle2, Database, Shield, Wifi, FileWarning, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import type { StructuredError } from "@/lib/errors";
import type { ErrorCategory } from "@/lib/errors";

const categoryConfig: Record<ErrorCategory, { icon: typeof AlertTriangle; color: string; bg: string; border: string; label: string }> = {
  validation: { icon: FileWarning, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", label: "خطأ في البيانات" },
  prisma: { icon: Database, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", label: "خطأ في قاعدة البيانات" },
  api: { icon: Code, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", label: "خطأ في واجهة البرمجة" },
  database: { icon: Database, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", label: "خطأ في قاعدة البيانات" },
  auth: { icon: Shield, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", label: "خطأ في المصادقة" },
  network: { icon: Wifi, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", label: "خطأ في الاتصال" },
  render: { icon: Code, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", label: "خطأ في العرض" },
  unknown: { icon: AlertTriangle, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/30", border: "border-slate-200 dark:border-slate-700", label: "خطأ غير معروف" },
};

interface ErrorDisplayProps {
  error: StructuredError;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorDisplay({ error, onRetry, compact = false }: ErrorDisplayProps) {
  const [copied, setCopied] = useState(false);
  const config = categoryConfig[error.category] || categoryConfig.unknown;
  const Icon = config.icon;

  const handleCopy = useCallback(() => {
    const text = [
      `رقم المرجع: ${error.id}`,
      `نوع الخطأ: ${error.name}`,
      `التصنيف: ${error.category}`,
      `الرسالة: ${error.message}`,
      error.cause ? `السبب: ${error.cause}` : "",
      error.location ? `المكان: ${error.location}` : "",
      error.suggestion ? `الحل المقترح: ${error.suggestion}` : "",
      error.statusCode ? `كود الحالة: ${error.statusCode}` : "",
      error.prismaOperation ? `العملية: ${error.prismaOperation}` : "",
      error.fields?.length ? `حقول خاطئة: ${error.fields.map(f => `${f.field}: ${f.message}`).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [error]);

  if (compact) {
    return (
      <div className={`rounded-lg border p-4 ${config.bg} ${config.border}`}>
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{error.message}</p>
            {error.suggestion && <p className="text-xs text-muted-foreground mt-1">{error.suggestion}</p>}
            <p className="text-[10px] text-muted-foreground mt-2 font-mono">مرجع: {error.id}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-6 ${config.bg} ${config.border} max-w-lg w-full`}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.bg} ${config.border} border`}>
          <Icon className={`h-6 w-6 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground">{config.label}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{error.name}</p>
        </div>
      </div>

      {/* Error Message */}
      <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 mb-4 border border-inherit">
        <p className="text-sm font-medium text-foreground">{error.message}</p>
      </div>

      {/* Cause */}
      {error.cause && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">السبب</p>
          <p className="text-sm text-foreground">{error.cause}</p>
        </div>
      )}

      {/* Location */}
      {error.location && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">مكان الخطأ</p>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{error.location}</code>
        </div>
      )}

      {/* Status Code */}
      {error.statusCode && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">كود الحالة</p>
          <span className="text-sm font-mono font-bold text-foreground">{error.statusCode}</span>
        </div>
      )}

      {/* Prisma Operation */}
      {error.prismaOperation && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">العملية الفاشلة</p>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{error.prismaOperation}</code>
        </div>
      )}

      {/* Validation Fields */}
      {error.fields && error.fields.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">حقول تحتاج إصلاح</p>
          <div className="space-y-1.5">
            {error.fields.map((field, i) => (
              <div key={i} className="flex items-center gap-2 text-sm rounded bg-white/60 dark:bg-black/20 px-3 py-2 border border-inherit">
                <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0">{field.field}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-foreground">{field.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion */}
      {error.suggestion && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 mb-4">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">💡 الحل المقترح</p>
          <p className="text-sm text-emerald-800 dark:text-emerald-300">{error.suggestion}</p>
        </div>
      )}

      {/* Reference ID */}
      <div className="flex items-center justify-between pt-3 border-t border-inherit">
        <div>
          <p className="text-[10px] text-muted-foreground">رقم مرجعي للخطأ</p>
          <p className="text-xs font-mono font-bold text-foreground">{error.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "تم النسخ" : "نسخ التفاصيل"}
          </Button>
          {onRetry && (
            <Button size="sm" onClick={onRetry} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة المحاولة
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
