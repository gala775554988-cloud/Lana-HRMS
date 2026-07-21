"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, Banknote, XCircle, RefreshCw, Printer } from "lucide-react";

type PayrollPeriod = { id: string; name: string; startDate: string; endDate: string; status: string };
type RunListItem = { id: string; name: string; period: string; status: string; paidAt: string | null; createdAt: string };
type RunDetail = {
  run: RunListItem & { periodId?: string; costCenterId?: string };
  totals: { gross: number; net: number; deductions: number };
  employeeCount: number;
};

const STATUS_LABEL: Record<string, string> = { DRAFT: "مسودة", PROCESSING: "قيد المراجعة", APPROVED: "تم الاعتماد", PAID: "تم الصرف", CANCELLED: "ملغي" };
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700"
};

export function PayrollRunManager() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [periodName, setPeriodName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/hr/payroll-runs?pageSize=50", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (data?.records) setRuns(data.records);
  }, []);

  const loadPeriods = useCallback(async () => {
    const res = await fetch("/api/hr/payroll-periods?pageSize=50", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (data?.records) setPeriods(data.records);
  }, []);

  useEffect(() => {
    loadRuns();
    loadPeriods();
  }, [loadRuns, loadPeriods]);

  async function openRun(id: string) {
    setLoading(true);
    const res = await fetch(`/api/enterprise/payroll/run/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (data?.success) setSelectedRun(data);
    else setMessage(data?.message || "تعذر تحميل تفاصيل المسير");
  }

  async function createRun() {
    if (!periodName || !startDate || !endDate) {
      setMessage("يرجى تعبئة اسم الفترة وتاريخ البداية والنهاية");
      return;
    }
    setActionLoading(true);
    setMessage(null);
    const res = await fetch("/api/enterprise/payroll/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `مسير رواتب ${periodName}`,
        period: periodName,
        startDate,
        endDate,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined
      })
    });
    const data = await res.json().catch(() => null);
    setActionLoading(false);
    if (data?.success) {
      setMessage(`تم احتساب الرواتب لـ ${data.computed} موظف${data.errors ? ` (${data.errors} أخطاء)` : ""}`);
      await loadRuns();
      openRun(data.run.id);
    } else {
      setMessage(data?.message || "فشل إنشاء مسير الرواتب");
    }
  }

  async function transition(action: string) {
    if (!selectedRun) return;
    setActionLoading(true);
    const res = await fetch(`/api/enterprise/payroll/run/${selectedRun.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await res.json().catch(() => null);
    setActionLoading(false);
    if (data?.success) {
      setMessage("تم تحديث حالة المسير بنجاح");
      await loadRuns();
      openRun(selectedRun.run.id);
    } else {
      setMessage(data?.message || "فشل تنفيذ الإجراء");
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>إنشاء مسير رواتب جديد</CardTitle>
          <CardDescription>اختر الفترة والنطاق، ثم احسب رواتب جميع الموظفين المطابقين تلقائياً عبر محرك الرواتب.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>اسم الفترة (مثال: 2026-07)</Label>
            <Input value={periodName} onChange={(e) => setPeriodName(e.target.value)} placeholder="2026-07" />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ البداية</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ النهاية</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الفرع (اختياري، ID)</Label>
            <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="اتركه فارغاً لكل الفروع" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>القسم (اختياري، ID)</Label>
            <Input value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} placeholder="اتركه فارغاً لكل الأقسام" />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button onClick={createRun} disabled={actionLoading} className="gap-2 w-full">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              احتساب مسير الرواتب
            </Button>
          </div>
        </CardContent>
      </Card>

      {message && <div className="rounded-xl border bg-muted/40 p-3 text-sm">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-1">
          <CardHeader><CardTitle>مسيرات الرواتب</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto">
            {runs.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">لا يوجد مسيرات رواتب بعد</p>}
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => openRun(run.id)}
                className={`w-full text-right rounded-xl border p-3 text-sm transition hover:bg-muted/50 ${selectedRun?.run.id === run.id ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{run.name}</span>
                  <Badge className={STATUS_COLOR[run.status]}>{STATUS_LABEL[run.status] ?? run.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{run.period}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle>تفاصيل المسير</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : !selectedRun ? (
              <p className="text-center text-muted-foreground py-12">اختر مسير رواتب لعرض تفاصيله</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{selectedRun.run.name}</h3>
                    <Badge className={STATUS_COLOR[selectedRun.run.status]}>{STATUS_LABEL[selectedRun.run.status] ?? selectedRun.run.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {selectedRun.run.status === "DRAFT" && (
                      <Button size="sm" onClick={() => transition("submit")} disabled={actionLoading} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />إرسال للمراجعة</Button>
                    )}
                    {selectedRun.run.status === "PROCESSING" && (
                      <Button size="sm" onClick={() => transition("approve")} disabled={actionLoading} className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />اعتماد</Button>
                    )}
                    {selectedRun.run.status === "APPROVED" && (
                      <Button size="sm" onClick={() => transition("pay")} disabled={actionLoading} className="gap-1 bg-emerald-600 hover:bg-emerald-700"><Banknote className="h-3.5 w-3.5" />صرف الرواتب</Button>
                    )}
                    {["DRAFT", "PROCESSING", "APPROVED"].includes(selectedRun.run.status) && (
                      <Button size="sm" variant="outline" onClick={() => transition("cancel")} disabled={actionLoading} className="gap-1 text-rose-600"><XCircle className="h-3.5 w-3.5" />إلغاء</Button>
                    )}
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <a href={`/print-reports/payroll-register?runId=${selectedRun.run.id}`} target="_blank" rel="noreferrer"><Printer className="h-3.5 w-3.5" />طباعة السجل</a>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-xl border"><p className="text-xs text-muted-foreground">عدد الموظفين</p><p className="text-xl font-bold mt-1">{selectedRun.employeeCount}</p></div>
                  <div className="p-4 rounded-xl border"><p className="text-xs text-muted-foreground">إجمالي الرواتب</p><p className="text-xl font-bold mt-1">{selectedRun.totals.gross.toLocaleString("ar-SA")}</p></div>
                  <div className="p-4 rounded-xl border"><p className="text-xs text-muted-foreground">صافي الرواتب</p><p className="text-xl font-bold mt-1 text-emerald-600">{selectedRun.totals.net.toLocaleString("ar-SA")}</p></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
