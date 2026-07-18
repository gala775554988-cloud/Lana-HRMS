"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncResult = {
  success: boolean;
  message?: string;
  totalFetched?: number;
  created?: number;
  updated?: number;
  usersCreated?: number;
  managersUpdated?: number;
  forcedCodeDisplacements?: number;
  skipped?: number;
  durationMs?: number;
  sponsorFields?: string[];
};

export function OdooEmployeeMasterSyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  function runSync() {
    setResult(null);
    startTransition(async () => {
      const response = await fetch("/api/integrations/odoo/sync/employee-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 500 }),
      });
      const json = await response.json().catch(() => ({ success: false, message: "Invalid response" }));
      setResult(json);
    });
  }

  return (
    <div className="rounded-2xl border border-primary/12 bg-gradient-to-br from-primary/8 to-white p-4 shadow-sm dark:border-primary/50 dark:from-primary/30 dark:to-slate-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-black text-primary dark:text-primary/12">
            <Zap className="h-5 w-5 text-primary" />
            مزامنة الموظفين الدقيقة من Odoo
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            يزامن الاسم، رقم الهوية، الكود، الكفيل، والمدير مباشرة من Odoo. عند تعارض الكود يتم اعتماد كود Odoo ونقل الكود القديم مؤقتاً.
          </p>
        </div>
        <Button onClick={runSync} disabled={pending} className="min-w-52 gap-2 bg-primary text-white hover:bg-primary">
          <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {pending ? "جاري المزامنة..." : "مزامنة الموظفين الآن"}
        </Button>
      </div>

      {result ? (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          {result.success ? (
            <div className="grid gap-2 md:grid-cols-4">
              <div>المجلوب من Odoo: <strong>{result.totalFetched ?? 0}</strong></div>
              <div>جديد: <strong>{result.created ?? 0}</strong></div>
              <div>محدث: <strong>{result.updated ?? 0}</strong></div>
              <div>مدراء محدثون: <strong>{result.managersUpdated ?? 0}</strong></div>
              <div>حسابات مستخدمين: <strong>{result.usersCreated ?? 0}</strong></div>
              <div>أكواد متعارضة تم نقلها: <strong>{result.forcedCodeDisplacements ?? 0}</strong></div>
              <div>أخطاء/متجاوز: <strong>{result.skipped ?? 0}</strong></div>
              <div>المدة: <strong>{Math.round((result.durationMs ?? 0) / 1000)}ث</strong></div>
              <div className="md:col-span-4">حقول الكفيل المكتشفة في Odoo: <strong>{result.sponsorFields?.join(", ") || "لم يتم العثور على حقل كفيل في Odoo"}</strong></div>
            </div>
          ) : (
            <p className="font-bold">فشلت المزامنة: {result.message}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
