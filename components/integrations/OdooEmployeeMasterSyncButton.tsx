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
          <div className="flex items-center gap-2 font-black text-primary dark:text-primary/90">
            <Zap className="h-5 w-5 text-primary" />
            مزامنة الموظفين والمستشفيات والحسابات التحليلية والمستندات الدقيقة من Odoo
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            يزامن الاسم، رقم الهوية، الكود، الكفيل، المدير، المستشفيات (school)، الحساب التحليلي (costCenter)، وكافة المرفقات والوثائق مباشرة من Odoo.
          </p>
        </div>
        <Button onClick={runSync} disabled={pending} className="min-w-64 gap-2 bg-primary text-white hover:bg-primary/90 font-black shadow-md shadow-primary/20">
          <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {pending ? "جاري المزامنة الشاملة..." : "مزامنة شاملة (موظفين + مستشفيات + مستندات) الآن 🔄"}
        </Button>
      </div>

      {result ? (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-900"}`}>
          {result.success ? (
            <div className="grid gap-2 md:grid-cols-4 font-semibold">
              <div>المجلوب من Odoo: <strong className="text-primary font-black">{result.totalFetched ?? 0}</strong></div>
              <div>جديد: <strong className="text-emerald-600 font-black">{result.created ?? 0}</strong></div>
              <div>محدث: <strong className="text-primary font-black">{result.updated ?? 0}</strong></div>
              <div>وثائق ومستندات مزامنة: <strong className="text-emerald-600 font-black">{(result as any).documentsImported ?? 0}</strong></div>
              <div>مدراء ومستشفيات محدثة: <strong className="font-black">{result.managersUpdated ?? 0}</strong></div>
              <div>حسابات مستخدمين: <strong className="font-black">{result.usersCreated ?? 0}</strong></div>
              <div>أكواد متعارضة تم نقلها: <strong className="font-black">{result.forcedCodeDisplacements ?? 0}</strong></div>
              <div>أخطاء/متجاوز: <strong className="font-black">{result.skipped ?? 0}</strong></div>
              <div className="md:col-span-4 space-y-1 text-xs pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <div>حقول الكفيل المكتشفة في Odoo: <strong>{result.sponsorFields?.join(", ") || "لا يوجد حقل مخصص لكفيل في هذا السيرفر"}</strong></div>
                <div>حقول المستشفيات/مواقع العمل المكتشفة: <strong>{(result as any).hospitalFields?.join(", ") || "لا يوجد حقل مخصص للمستشفى (تم استخدام الافتراضي)"}</strong></div>
                <div>حقول الحساب التحليلي المكتشفة: <strong>{(result as any).analyticFields?.join(", ") || "لا يوجد حقل مخصص للحساب التحليلي (تم استخدام الافتراضي)"}</strong></div>
              </div>
            </div>
          ) : (
            <p className="font-bold">فشلت المزامنة: {result.message}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
