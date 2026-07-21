"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight, ChevronLeft, ListChecks } from "lucide-react";

type ActivityEntry = {
  id: string;
  action: string;
  runId: string | null;
  runName: string | null;
  runPeriod: string | null;
  actorName: string;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  create: "إنشاء مسير رواتب",
  payroll_submit: "إرسال للمراجعة",
  payroll_approve: "اعتماد المسير",
  payroll_pay: "صرف الرواتب",
  payroll_cancel: "إلغاء المسير",
  payroll_lock: "قفل المسير",
  payroll_unlock: "فتح قفل المسير",
  payroll_archive: "أرشفة المسير",
  payroll_recalculate: "إعادة احتساب",
  payroll_duplicate: "نسخ مسير رواتب"
};

export function PayrollActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (actionFilter) params.set("action", actionFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/enterprise/payroll/activity?${params}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (data?.success) {
      setEntries(data.entries);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [page, actionFilter, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-4.5 w-4.5 text-primary" />سجل نشاط الرواتب الكامل</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>نوع الإجراء</Label>
            <select
              value={actionFilter}
              onChange={(e) => { setPage(1); setActionFilter(e.target.value); }}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">كل الإجراءات</option>
              {Object.entries(ACTION_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          </div>
          <div className="space-y-1.5">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-16 text-sm">لا يوجد نشاط مطابق</p>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-4 text-sm">
                  <div>
                    <p className="font-semibold">{ACTION_LABEL[entry.action] ?? entry.action}</p>
                    {entry.runName ? (
                      <Link href={`/payroll?tab=payroll-run&runId=${entry.runId}`} className="text-xs text-primary hover:underline">
                        {entry.runName} ({entry.runPeriod})
                      </Link>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0">{entry.actorName} · {new Date(entry.createdAt).toLocaleString("ar-SA")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))} className="gap-1">
            <ChevronRight className="h-4 w-4" />السابق
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))} className="gap-1">
            التالي<ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
