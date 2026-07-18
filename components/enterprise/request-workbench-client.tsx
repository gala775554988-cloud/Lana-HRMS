"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Check, ChevronsUpDown, History, Loader2, RotateCcw, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApprovalTimeline } from "@/components/enterprise/approval-timeline";
import { PENDING_APPROVALS_QUERY_KEY } from "@/lib/hooks/use-pending-approvals-count";

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
  ["decided", "طلبات مكتملة"],
  ["completed", "المكتملة (معتمدة فقط)"],
  ["rejected", "المرفوضة"]
] as const;

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  RETURNED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "تمت الموافقة",
  COMPLETED: "مكتملة",
  REJECTED: "مرفوض",
  PENDING: "قيد الانتظار",
  RETURNED: "أُرجع"
};

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
  steps?: Array<{ step: number; status: string }>;
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
type WorkbenchData = {
  requests: RequestRecord[];
  types: string[];
  stats: Stats;
  approvers: Approver[];
  pageCount: number;
};

const emptyStats: Stats = { total: 0, waiting: 0, highPriority: 0, deferred: 0, completed: 0, rejected: 0 };
// Approve/reject/transfer are the decisions that take a request out of
// "waiting for me" -- these get the row removed from the UI immediately;
// other decisions (defer/note/priority) wait for the server response as
// before since they don't change whether the item is still in this queue.
const REMOVING_DECISIONS = new Set(["APPROVE", "REJECT", "TRANSFER"]);

export function RequestWorkbenchClient({ mode = "center" }: { mode?: "center" | "inbox" | "outbox" }) {
  const [type, setType] = useState("ALL");
  const [scope, setScope] = useState(mode === "inbox" ? "waiting" : "all");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetUserId, setTargetUserId] = useState("");
  const [deferPreset, setDeferPreset] = useState("tomorrow");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [timelineWorkflowId, setTimelineWorkflowId] = useState<string | null>(null);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Reset row selection whenever the visible set of requests changes
  // underneath it (new filters, new page).
  useEffect(() => { setSelected(new Set()); }, [type, scope, sort, debouncedSearch, mode, page]);

  const queryKey = useMemo(
    () => ["enterprise-requests", type, scope, sort, debouncedSearch, mode, page] as const,
    [type, scope, sort, debouncedSearch, mode, page]
  );

  const { data, isFetching, refetch } = useQuery<WorkbenchData>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ type, scope, sort, search: debouncedSearch, mode, page: String(page), pageSize: "30" });
      const response = await fetch(`/api/enterprise/requests?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.message || "Failed to load requests");
      return {
        requests: json.requests ?? [],
        types: ["ALL", ...(json.types ?? [])].filter((value: string, index: number, array: string[]) => array.indexOf(value) === index),
        stats: json.stats ?? emptyStats,
        approvers: (json.approvers ?? []).filter((approver: Approver) => approver.userId),
        pageCount: json.pageCount ?? 1
      };
    },
    placeholderData: keepPreviousData
  });

  const requests = data?.requests ?? [];
  const types = data?.types ?? ["ALL"];
  const stats = data?.stats ?? emptyStats;
  const approvers = data?.approvers ?? [];
  const pageCount = data?.pageCount ?? 1;

  const decideMutation = useMutation({
    mutationFn: async (vars: { id: string; decision: string; extra?: Record<string, unknown> }) => {
      const response = await fetch(`/api/enterprise/workflows/${vars.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: vars.decision, ...(vars.extra ?? {}) })
      });
      const json = await response.json().catch(() => ({ success: false, message: "استجابة غير صالحة من الخادم" }));
      if (!json.success) throw new Error(json.message || "فشل تحديث الطلب");
      return json;
    },
    onMutate: async (vars) => {
      if (!REMOVING_DECISIONS.has(vars.decision)) return undefined;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkbenchData>(queryKey);
      queryClient.setQueryData<WorkbenchData>(queryKey, (current) =>
        current ? { ...current, requests: current.requests.filter((request) => request.id !== vars.id) } : current
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "فشل تحديث الطلب");
    },
    onSuccess: () => { setMessageTone("success"); setMessage("تم تحديث الطلب بنجاح"); },
    onSettled: () => {
      // Reconcile stats/counts with the server in the background regardless
      // of whether this decision optimistically touched the row list.
      queryClient.invalidateQueries({ queryKey: ["enterprise-requests"] });
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_QUERY_KEY });
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async (vars: { ids: string[]; decision: string; extra?: Record<string, unknown> }) => {
      const failures: string[] = [];
      for (const id of vars.ids) {
        const response = await fetch(`/api/enterprise/workflows/${id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: vars.decision, ...(vars.extra ?? {}) })
        });
        const json = await response.json().catch(() => ({ success: false }));
        if (!json.success) failures.push(id);
      }
      return { failures, total: vars.ids.length };
    },
    onMutate: async (vars) => {
      if (!REMOVING_DECISIONS.has(vars.decision)) return undefined;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkbenchData>(queryKey);
      const idSet = new Set(vars.ids);
      queryClient.setQueryData<WorkbenchData>(queryKey, (current) =>
        current ? { ...current, requests: current.requests.filter((request) => !idSet.has(request.id)) } : current
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "فشل تنفيذ العملية الجماعية");
    },
    onSuccess: (result) => {
      setSelected(new Set());
      setMessageTone(result.failures.length ? "error" : "success");
      setMessage(result.failures.length ? `تم التنفيذ مع فشل ${result.failures.length} من ${result.total} طلب` : "تم تنفيذ العملية الجماعية");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-requests"] });
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_QUERY_KEY });
    }
  });

  function decide(id: string, decision: "APPROVE" | "REJECT" | "RETURN" | "TRANSFER" | "DEFER" | "NOTE" | "PRIORITY", extra: Record<string, unknown> = {}) {
    decideMutation.mutate({ id, decision, extra });
  }

  function bulk(decision: "APPROVE" | "REJECT" | "TRANSFER" | "DEFER" | "PRIORITY") {
    if (!selectedIds.length) return;
    const extra = decision === "TRANSFER" ? { targetUserId } : decision === "DEFER" ? { deferPreset } : decision === "PRIORITY" ? { priority: "High" } : {};
    bulkMutation.mutate({ ids: selectedIds, decision, extra });
  }

  function note(id: string) {
    const comments = window.prompt("إضافة ملاحظة");
    if (comments !== null) decide(id, "NOTE", { comments });
  }

  const isPending = decideMutation.isPending || bulkMutation.isPending;
  // Which exact row+decision is in flight, so only that button shows a
  // spinner instead of every action on every row looking identically
  // "stuck" while any one mutation is pending.
  const isRowPending = (id: string) => decideMutation.isPending && decideMutation.variables?.id === id;
  const isActionPending = (id: string, decision: string) => isRowPending(id) && decideMutation.variables?.decision === decision;
  // Mirrors decideWorkflowStep's own precondition (instance.status === PENDING
  // AND the current step number is itself still PENDING, not DEFERRED) so the
  // buttons are only shown when the API call would actually succeed.
  const isActionable = (request: RequestRecord) =>
    request.status === "PENDING" && (request.steps ?? []).find((step) => step.step === request.currentStep)?.status === "PENDING";

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
            <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") refetch(); }} placeholder="بحث سريع: الاسم، الرقم، الهوية، القسم، الفرع، المشروع، نوع الطلب" className="pr-9" />
          </div>
          <select value={scope} onChange={(event) => setScope(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            {scopeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button type="button" onClick={() => refetch()}>بحث</Button>
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

      {message ? (
        <div className={`rounded-xl border p-3 text-sm ${messageTone === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"}`}>
          {message}
        </div>
      ) : null}

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
                  <td className="px-3 py-3">
                    <Badge className={STATUS_BADGE[request.status] ?? "bg-slate-100 text-slate-700"}>
                      {STATUS_LABEL[request.status] ?? request.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{request.currentApprover}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => setTimelineWorkflowId(request.id)} disabled={isRowPending(request.id)}><History className="h-3.5 w-3.5" />السجل</Button>
                      {/* Decision actions only make sense on a request that's actually
                          awaiting a decision right now -- the "all"/"decided" scopes
                          legitimately include already-APPROVED/REJECTED/RETURNED rows,
                          and calling decideWorkflowStep on those always fails with
                          "No pending workflow step" (there's nothing left to decide),
                          which read as "the button does nothing" from the UI. */}
                      {isActionable(request) ? (
                        <>
                          <Button type="button" size="sm" onClick={() => decide(request.id, "APPROVE")} disabled={isPending}>
                            {isActionPending(request.id, "APPROVE") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {isActionPending(request.id, "APPROVE") ? "جارٍ..." : "موافقة"}
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => decide(request.id, "REJECT")} disabled={isPending}>
                            {isActionPending(request.id, "REJECT") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            {isActionPending(request.id, "REJECT") ? "جارٍ..." : "رفض"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => decide(request.id, "RETURN")} disabled={isPending}>
                            {isActionPending(request.id, "RETURN") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {isActionPending(request.id, "RETURN") ? "جارٍ..." : "إرجاع"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => targetUserId && decide(request.id, "TRANSFER", { targetUserId })} disabled={isPending || !targetUserId}>
                            {isActionPending(request.id, "TRANSFER") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {isActionPending(request.id, "TRANSFER") ? "جارٍ..." : "تحويل"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => decide(request.id, "DEFER", { deferPreset })} disabled={isPending}>
                            {isActionPending(request.id, "DEFER") ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : null}{isActionPending(request.id, "DEFER") ? "جارٍ..." : "تأجيل"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => note(request.id)} disabled={isPending}>
                            {isActionPending(request.id, "NOTE") ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : null}{isActionPending(request.id, "NOTE") ? "جارٍ..." : "ملاحظة"}
                          </Button>
                        </>
                      ) : (
                        <span className="px-2 py-1.5 text-xs text-muted-foreground">
                          {request.status !== "PENDING" ? "لا يوجد إجراء متاح (تم البت في الطلب)" : "لا يوجد إجراء متاح حالياً (الطلب مؤجل)"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? <tr><td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">{isFetching ? "جارِ التحميل..." : "لا توجد طلبات"}</td></tr> : null}
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
