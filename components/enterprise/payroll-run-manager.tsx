"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, Play, CheckCircle2, Banknote, XCircle, RefreshCw, Printer, Search,
  Copy, Lock, Unlock, Archive, History, BookmarkPlus, Bookmark, X, CheckSquare, Square
} from "lucide-react";

type PayrollPeriod = { id: string; name: string; startDate: string; endDate: string; status: string };
type RunListItem = { id: string; name: string; period: string; status: string; paidAt: string | null; createdAt: string };
type HistoryEntry = { id: string; action: string; actorName: string; createdAt: string };
type RunDetail = {
  run: RunListItem & { periodId?: string; costCenterId?: string };
  totals: { gross: number; net: number; deductions: number };
  employeeCount: number;
  history: HistoryEntry[];
};
type SavedFilter = { name: string; search: string; status: string; sortBy: string };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PROCESSING: "قيد المراجعة",
  APPROVED: "تم الاعتماد",
  PAID: "تم الصرف",
  CANCELLED: "ملغي",
  LOCKED: "مقفل",
  ARCHIVED: "مؤرشف"
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  LOCKED: "bg-indigo-100 text-indigo-700",
  ARCHIVED: "bg-slate-200 text-slate-500"
};
const HISTORY_LABEL: Record<string, string> = {
  create: "تم الإنشاء",
  payroll_submit: "أُرسل للمراجعة",
  payroll_approve: "تم الاعتماد",
  payroll_pay: "تم الصرف",
  payroll_cancel: "تم الإلغاء",
  payroll_lock: "تم القفل",
  payroll_unlock: "تم فتح القفل",
  payroll_archive: "تمت الأرشفة",
  payroll_recalculate: "أُعيد الاحتساب"
};
const SAVED_FILTERS_KEY = "payrollRunSavedFilters";
const CANCELLABLE = ["DRAFT", "PROCESSING", "APPROVED"];
const ARCHIVABLE = ["LOCKED", "CANCELLED"];

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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status">("newest");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState<RunListItem | null>(null);
  const [dupPeriod, setDupPeriod] = useState("");
  const [dupStart, setDupStart] = useState("");
  const [dupEnd, setDupEnd] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_FILTERS_KEY);
      if (raw) setSavedFilters(JSON.parse(raw));
    } catch {}
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/hr/payroll-runs?pageSize=100", { cache: "no-store" });
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

  async function transition(action: string, runId?: string) {
    const targetId = runId ?? selectedRun?.run.id;
    if (!targetId) return;
    setActionLoading(true);
    const res = await fetch(`/api/enterprise/payroll/run/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await res.json().catch(() => null);
    setActionLoading(false);
    if (data?.success) {
      setMessage("تم تحديث حالة المسير بنجاح");
      await loadRuns();
      if (selectedRun?.run.id === targetId || !runId) openRun(targetId);
    } else {
      setMessage(data?.message || "فشل تنفيذ الإجراء");
    }
    return data?.success;
  }

  async function recalculate() {
    if (!selectedRun) return;
    setActionLoading(true);
    const res = await fetch(`/api/enterprise/payroll/run/${selectedRun.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recalculate" })
    });
    const data = await res.json().catch(() => null);
    setActionLoading(false);
    if (data?.success) {
      setMessage(`تمت إعادة الاحتساب لـ ${data.computed} موظف${data.errors ? ` (${data.errors} أخطاء)` : ""}`);
      openRun(selectedRun.run.id);
    } else {
      setMessage(data?.message || "فشلت إعادة الاحتساب");
    }
  }

  function startDuplicate(run: RunListItem) {
    setDuplicating(run);
    setDupPeriod("");
    setDupStart("");
    setDupEnd("");
  }

  async function confirmDuplicate() {
    if (!duplicating || !dupPeriod || !dupStart || !dupEnd) {
      setMessage("يرجى تعبئة اسم الفترة الجديدة وتاريخ البداية والنهاية");
      return;
    }
    setActionLoading(true);
    const res = await fetch(`/api/enterprise/payroll/run/${duplicating.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: dupPeriod, startDate: dupStart, endDate: dupEnd })
    });
    const data = await res.json().catch(() => null);
    setActionLoading(false);
    if (data?.success) {
      setMessage(`تم إنشاء نسخة جديدة واحتساب ${data.computed} موظف`);
      setDuplicating(null);
      await loadRuns();
      openRun(data.run.id);
    } else {
      setMessage(data?.message || "فشل نسخ المسير");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkCancel() {
    const targets = filteredRuns.filter((r) => selectedIds.has(r.id) && CANCELLABLE.includes(r.status));
    if (targets.length === 0) return;
    setActionLoading(true);
    for (const run of targets) await transition("cancel", run.id);
    setSelectedIds(new Set());
    setActionLoading(false);
  }

  async function bulkArchive() {
    const targets = filteredRuns.filter((r) => selectedIds.has(r.id) && ARCHIVABLE.includes(r.status));
    if (targets.length === 0) return;
    setActionLoading(true);
    for (const run of targets) await transition("archive", run.id);
    setSelectedIds(new Set());
    setActionLoading(false);
  }

  function saveCurrentFilter() {
    const name = window.prompt("اسم الفلتر المحفوظ:");
    if (!name) return;
    const next = [...savedFilters.filter((f) => f.name !== name), { name, search, status: statusFilter, sortBy }];
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  function applyFilter(filter: SavedFilter) {
    setSearch(filter.search);
    setStatusFilter(filter.status);
    setSortBy(filter.sortBy as typeof sortBy);
  }

  function removeFilter(name: string) {
    const next = savedFilters.filter((f) => f.name !== name);
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  const filteredRuns = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = runs.filter((run) => {
      if (statusFilter && run.status !== statusFilter) return false;
      if (term && !run.name.toLowerCase().includes(term) && !run.period.toLowerCase().includes(term)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status);
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortBy === "oldest" ? -diff : diff;
    });
    return list;
  }, [runs, search, statusFilter, sortBy]);

  const selectableCount = filteredRuns.filter((r) => CANCELLABLE.includes(r.status) || ARCHIVABLE.includes(r.status)).length;

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

      {duplicating ? (
        <Card className="rounded-2xl border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Copy className="h-4.5 w-4.5" />نسخ "{duplicating.name}" إلى فترة جديدة</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>اسم الفترة الجديدة</Label>
              <Input value={dupPeriod} onChange={(e) => setDupPeriod(e.target.value)} placeholder="2026-08" />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ البداية</Label>
              <Input type="date" value={dupStart} onChange={(e) => setDupStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ النهاية</Label>
              <Input type="date" value={dupEnd} onChange={(e) => setDupEnd(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={confirmDuplicate} disabled={actionLoading} className="gap-2 flex-1">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                نسخ واحتساب
              </Button>
              <Button variant="outline" size="icon" onClick={() => setDuplicating(null)}><X className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-1">
          <CardHeader className="space-y-3">
            <CardTitle>مسيرات الرواتب</CardTitle>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الفترة..." className="pr-9" />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 flex-1 rounded-xl border border-input bg-background px-2 text-xs"
              >
                <option value="">كل الحالات</option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="flex h-9 flex-1 rounded-xl border border-input bg-background px-2 text-xs"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
                <option value="status">حسب الحالة</option>
              </select>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={saveCurrentFilter} title="حفظ الفلتر الحالي">
                <BookmarkPlus className="h-4 w-4" />
              </Button>
            </div>
            {savedFilters.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {savedFilters.map((filter) => (
                  <span key={filter.name} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-1 text-[11px] font-semibold">
                    <button type="button" onClick={() => applyFilter(filter)} className="flex items-center gap-1 hover:text-primary">
                      <Bookmark className="h-3 w-3" />{filter.name}
                    </button>
                    <button type="button" onClick={() => removeFilter(filter.name)} className="text-muted-foreground hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {selectableCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                <span className="text-xs text-muted-foreground">{selectedIds.size} محدد</span>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-rose-600" disabled={actionLoading || selectedIds.size === 0} onClick={bulkCancel}>
                  <XCircle className="h-3.5 w-3.5" />إلغاء المحدد
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actionLoading || selectedIds.size === 0} onClick={bulkArchive}>
                  <Archive className="h-3.5 w-3.5" />أرشفة المحدد
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 max-h-[32rem] overflow-y-auto">
            {filteredRuns.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">لا يوجد مسيرات رواتب مطابقة</p>}
            {filteredRuns.map((run) => {
              const canBulkSelect = CANCELLABLE.includes(run.status) || ARCHIVABLE.includes(run.status);
              return (
                <div
                  key={run.id}
                  className={cn(
                    "w-full rounded-xl border p-3 text-sm transition hover:bg-muted/50 flex items-start gap-2",
                    selectedRun?.run.id === run.id ? "border-primary bg-primary/5" : ""
                  )}
                >
                  {canBulkSelect ? (
                    <button type="button" onClick={() => toggleSelect(run.id)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary">
                      {selectedIds.has(run.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <button onClick={() => openRun(run.id)} className="flex-1 text-right min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold truncate">{run.name}</span>
                      <Badge className={STATUS_COLOR[run.status]}>{STATUS_LABEL[run.status] ?? run.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{run.period}</p>
                  </button>
                </div>
              );
            })}
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">{selectedRun.run.name}</h3>
                    <Badge className={STATUS_COLOR[selectedRun.run.status]}>{STATUS_LABEL[selectedRun.run.status] ?? selectedRun.run.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRun.run.status === "DRAFT" && (
                      <Button size="sm" onClick={() => transition("submit")} disabled={actionLoading} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />إرسال للمراجعة</Button>
                    )}
                    {["DRAFT", "PROCESSING"].includes(selectedRun.run.status) && (
                      <Button size="sm" variant="outline" onClick={recalculate} disabled={actionLoading} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />إعادة احتساب</Button>
                    )}
                    {selectedRun.run.status === "PROCESSING" && (
                      <Button size="sm" onClick={() => transition("approve")} disabled={actionLoading} className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />اعتماد</Button>
                    )}
                    {selectedRun.run.status === "APPROVED" && (
                      <Button size="sm" onClick={() => transition("pay")} disabled={actionLoading} className="gap-1 bg-emerald-600 hover:bg-emerald-700"><Banknote className="h-3.5 w-3.5" />صرف الرواتب</Button>
                    )}
                    {selectedRun.run.status === "PAID" && (
                      <Button size="sm" variant="outline" onClick={() => transition("lock")} disabled={actionLoading} className="gap-1"><Lock className="h-3.5 w-3.5" />قفل نهائي</Button>
                    )}
                    {selectedRun.run.status === "LOCKED" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => transition("unlock")} disabled={actionLoading} className="gap-1"><Unlock className="h-3.5 w-3.5" />فتح القفل</Button>
                        <Button size="sm" variant="outline" onClick={() => transition("archive")} disabled={actionLoading} className="gap-1"><Archive className="h-3.5 w-3.5" />أرشفة</Button>
                      </>
                    )}
                    {selectedRun.run.status === "CANCELLED" && (
                      <Button size="sm" variant="outline" onClick={() => transition("archive")} disabled={actionLoading} className="gap-1"><Archive className="h-3.5 w-3.5" />أرشفة</Button>
                    )}
                    {["DRAFT", "PROCESSING", "APPROVED"].includes(selectedRun.run.status) && (
                      <Button size="sm" variant="outline" onClick={() => transition("cancel")} disabled={actionLoading} className="gap-1 text-rose-600"><XCircle className="h-3.5 w-3.5" />إلغاء</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startDuplicate(selectedRun.run)} disabled={actionLoading} className="gap-1"><Copy className="h-3.5 w-3.5" />نسخ</Button>
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <a href={`/print-reports/payroll-register?runId=${selectedRun.run.id}`} target="_blank" rel="noreferrer"><Printer className="h-3.5 w-3.5" />طباعة السجل</a>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="p-4 rounded-xl border"><p className="text-xs text-muted-foreground">عدد الموظفين</p><p className="text-xl font-bold mt-1">{selectedRun.employeeCount}</p></div>
                  <div className="p-4 rounded-xl border"><p className="text-xs text-muted-foreground">إجمالي الرواتب</p><p className="text-xl font-bold mt-1">{selectedRun.totals.gross.toLocaleString("ar-SA")}</p></div>
                  <div className="p-4 rounded-xl border"><p className="text-xs text-muted-foreground">صافي الرواتب</p><p className="text-xl font-bold mt-1 text-emerald-600">{selectedRun.totals.net.toLocaleString("ar-SA")}</p></div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-bold flex items-center gap-1.5"><History className="h-4 w-4 text-primary" />السجل الزمني للمسير</p>
                  {selectedRun.history.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3">لا يوجد سجل بعد</p>
                  ) : (
                    <ol className="relative border-r-2 border-muted mr-2 space-y-3 pt-1">
                      {selectedRun.history.map((entry) => (
                        <li key={entry.id} className="pr-4 relative">
                          <span className="absolute right-[-9px] top-1 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background" />
                          <p className="text-sm font-semibold">{HISTORY_LABEL[entry.action] ?? entry.action}</p>
                          <p className="text-xs text-muted-foreground">{entry.actorName} · {new Date(entry.createdAt).toLocaleString("ar-SA")}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
