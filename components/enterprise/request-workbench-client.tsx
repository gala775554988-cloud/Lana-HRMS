"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown, History, RotateCcw, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApprovalTimeline } from "@/components/enterprise/approval-timeline";

const typeLabels: Record<string, string> = {
  ALL: "كل الأنواع",
  LEAVE: "طلبات الإجازات",
  LOAN: "طلبات السلف",
  RESIDENCY: "طلبات الإقامة",
  DELEGATION: "طلبات الانتدابات",
  CUSTODY: "طلبات العهد",
  DOCUMENT: "طلبات الوثائق",
  EXPENSE: "طلبات المصروفات",
  LETTER: "طلبات الخطابات",
  OVERTIME: "طلبات الأوفر تايم"
};

const scopeOptions = [
  ["all", "كل الطلبات"],
  ["waiting", "بانتظار موافقتي"],
  ["mine", "طلباتي"],
  ["transferred", "تم تحويلها"],
  ["deferred", "المؤجلة"],
  ["completed", "المكتملة"],
  ["rejected", "المرفوضة"]
] as const;

const sortOptions = [
  ["newest", "الأحدث"],
  ["oldest", "الأقدم"],
  ["priority", "الأولوية"],
  ["date", "التاريخ"],
  ["sentAt", "وقت الإرسال"],
  ["department", "القسم"],
  ["branch", "الفرع"],
  ["project", "المشروع"],
  ["type", "نوع الطلب"]
] as const;

type RequestRecord = {
  id: string;
  type: string;
  entityId: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  priority: string;
  currentApprover: string;
  employee?: {
    employeeNumber: string;
    nationalId: string;
    firstName: string;
    lastName: string;
    department?: { name: string } | null;
    branch?: { name: string } | null;
    position?: { title: string } | null;
  };
};

type Approver = { userId: string; label: string; position: string };
type Stats = { total: number; waiting: number; highPriority: number; deferred: number; completed: number; rejected: number };

export function RequestWorkbenchClient({ mode = "center" }: { mode?: "center" | "inbox" | "outbox" }) {
  const [type, setType] = useState("ALL");
  const [scope, setScope] = useState(mode === "inbox" ? "waiting" : "all");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [types, setTypes] = useState<string[]>(["ALL"]);
  const [stats, setStats] = useState<Stats>({ total: 0, waiting: 0, highPriority: 0, deferred: 0, completed: 0, rejected: 0 });
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetUserId, setTargetUserId] = useState("");
  const [deferPreset, setDeferPreset] = useState("tomorrow");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [timelineWorkflowId, setTimelineWorkflowId] = useState<string | null>(null);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const load = useCallback(() => {
    const params = new URLSearchParams({ type, scope, sort, search, mode, page: String(page), pageSize: "30" });
    fetch(`/api/enterprise/requests?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load requests");
        setRequests(data.requests ?? []);
        setTypes(["ALL", ...(data.types ?? [])].filter((value, index, array) => array.indexOf(value) === index));
        setStats(data.stats ?? { total: 0, waiting: 0, highPriority: 0, deferred: 0, completed: 0, rejected: 0 });
        setApprovers((data.approvers ?? []).filter((approver: Approver) => approver.userId));
        setPageCount(data.pageCount ?? 1);
        setSelected(new Set());
      })
      .catch((error) => setMessage(error.message));
  }, [mode, page, scope, search, sort, type]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [load]);

  function decide(id: string, decision: "APPROVE" | "REJECT" | "RETURN" | "TRANSFER" | "DEFER" | "NOTE" | "PRIORITY", extra: Record<string, unknown> = {}) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/enterprise/workflows/${id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, ...extra })
        });
        const data = await response.json().catch(() => ({ success: false, message: "استجابة غير صالحة من الخادم" }));
        if (!data.success) {
          setMessage(data.message || "فشل تحديث الطلب");
          return;
        }
        setMessage("تم تحديث الطلب بنجاح");
        load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "فشل تحديث الطلب");
      }
    });
  }

  function bulk(decision: "APPROVE" | "REJECT" | "TRANSFER" | "DEFER" | "PRIORITY") {
    if (!selectedIds.length) return;
    startTransition(async () => {
      try {
        const failures: string[] = [];
        for (const id of selectedIds) {
          const extra = decision === "TRANSFER" ? { targetUserId } : decision === "DEFER" ? { deferPreset } : decision === "PRIORITY" ? { priority: "High" } : {};
          const response = await fetch(`/api/enterprise/workflows/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, ...extra }) });
          const data = await response.json().catch(() => ({ success: false }));
          if (!data.success) failures.push(id);
        }
        setMessage(failures.length ? `تم التنفيذ مع فشل ${failures.length} من ${selectedIds.length} طلب` : "تم تنفيذ العملية الجماعية");
        load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "فشل تنفيذ العملية الجماعية");
      }
    });
  }

  function note(id: string) {
    const comments = window.prompt("إضافة ملاحظة");
    if (comments !== null) decide(id, "NOTE", { comments });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="إجمالي الطلبات" value={stats.total} />
        <Stat label="بانتظار موافقتي" value={stats.waiting} />
        <Stat label="عالية الأولوية" value={stats.highPriority} />
        <Stat label="المؤجلة" value={stats.deferred} />
        <Stat label="المكتملة" value={stats.completed} />
        <Stat label="المرفوضة" value={stats.rejected} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {types.map((item) => (
            <Button key={item} type="button" variant={type === item ? "default" : "outline"} onClick={() => setType(item)}>
              {typeLabels[item] ?? item}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_160px]">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") load(); }} placeholder="بحث سريع: الاسم، الرقم، الهوية، القسم، الفرع، المشروع، نوع الطلب" className="pr-9" />
          </div>
          <select value={scope} onChange={(event) => setScope(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            {scopeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button type="button" onClick={load}>بحث</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={!selectedIds.length || isPending} onClick={() => bulk("APPROVE")}>اعتماد المحدد</Button>
          <Button type="button" size="sm" variant="destructive" disabled={!selectedIds.length || isPending} onClick={() => bulk("REJECT")}>رفض المحدد</Button>
          <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">تحويل إلى...</option>
            {approvers.map((approver) => <option key={approver.userId} value={approver.userId}>{approver.label} - {approver.position}</option>)}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={!selectedIds.length || !targetUserId || isPending} onClick={() => bulk("TRANSFER")}>تحويل المحدد</Button>
          <Button type="button" size="sm" variant="outline" disabled={!selectedIds.length || isPending} onClick={() => bulk("PRIORITY")}>تغيير الأولوية</Button>
          <select value={deferPreset} onChange={(event) => setDeferPreset(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="tomorrow">غداً</option>
            <option value="two-days">بعد يومين</option>
            <option value="week">بعد أسبوع</option>
          </select>
          <Button type="button" size="sm" variant="outline" disabled={!selectedIds.length || isPending} onClick={() => bulk("DEFER")}>تأجيل المحدد</Button>
        </div>
      </div>

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-start"><input type="checkbox" checked={requests.length > 0 && selected.size === requests.length} onChange={(event) => setSelected(event.target.checked ? new Set(requests.map((request) => request.id)) : new Set())} /></th>
                <th className="px-3 py-3 text-start">اسم الموظف</th>
                <th className="px-3 py-3 text-start">رقم الموظف</th>
                <th className="px-3 py-3 text-start">نوع الطلب</th>
                <th className="px-3 py-3 text-start">القسم</th>
                <th className="px-3 py-3 text-start">الفرع</th>
                <th className="px-3 py-3 text-start">الأولوية</th>
                <th className="px-3 py-3 text-start">تاريخ الإنشاء</th>
                <th className="px-3 py-3 text-start">آخر تحديث</th>
                <th className="px-3 py-3 text-start">الحالة</th>
                <th className="px-3 py-3 text-start">المعتمد الحالي</th>
                <th className="px-3 py-3 text-start">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(request.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(request.id); else next.delete(request.id); return next; })} /></td>
                  <td className="px-3 py-3">{request.employee?.firstName} {request.employee?.lastName}</td>
                  <td className="px-3 py-3">{request.employee?.employeeNumber}</td>
                  <td className="px-3 py-3">{typeLabels[request.type] ?? request.type}</td>
                  <td className="px-3 py-3">{request.employee?.department?.name ?? "-"}</td>
                  <td className="px-3 py-3">{request.employee?.branch?.name ?? "-"}</td>
                  <td className="px-3 py-3">{request.priority}</td>
                  <td className="px-3 py-3">{new Date(request.createdAt).toLocaleString("ar-SA")}</td>
                  <td className="px-3 py-3">{new Date(request.updatedAt).toLocaleString("ar-SA")}</td>
                  <td className="px-3 py-3">{request.status}</td>
                  <td className="px-3 py-3">{request.currentApprover}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => setTimelineWorkflowId(request.id)}><History className="h-3.5 w-3.5" />السجل</Button>
                      <Button type="button" size="sm" onClick={() => decide(request.id, "APPROVE")} disabled={isPending}><Check className="h-3.5 w-3.5" />موافقة</Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => decide(request.id, "REJECT")} disabled={isPending}><X className="h-3.5 w-3.5" />رفض</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => decide(request.id, "RETURN")} disabled={isPending}><RotateCcw className="h-3.5 w-3.5" />إرجاع</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => targetUserId && decide(request.id, "TRANSFER", { targetUserId })} disabled={isPending || !targetUserId}><Send className="h-3.5 w-3.5" />تحويل</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => decide(request.id, "DEFER", { deferPreset })} disabled={isPending}>تأجيل</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => note(request.id)} disabled={isPending}>ملاحظة</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? <tr><td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">لا توجد طلبات</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm text-muted-foreground">
        <span>صفحة {page} من {pageCount}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>السابق</Button>
          <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(value + 1, pageCount))}>التالي</Button>
        </div>
      </div>

      <ApprovalTimeline workflowId={timelineWorkflowId} onClose={() => setTimelineWorkflowId(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>;
}
