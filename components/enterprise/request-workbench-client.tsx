"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Check, ChevronsUpDown, History, Loader2, RotateCcw, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApprovalTimeline } from "@/components/enterprise/approval-timeline";
import { PENDING_APPROVALS_QUERY_KEY } from "@/lib/hooks/use-pending-approvals-count";
import { cn } from "@/lib/utils";

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

// Priority values come from priorityOf() in app/api/enterprise/requests/route.ts
// as "Low" | "Normal" | "High" (case-sensitive as stored, so match loosely).
const PRIORITY_ACCENT: Record<string, string> = {
  high: "bg-rose-500",
  normal: "bg-amber-400",
  medium: "bg-amber-400",
  low: "bg-slate-300 dark:bg-slate-700"
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
  // A notification's deep-link (?highlight=<workflowId>) always forces scope
  // to "all" up front -- the request it points at may have already left
  // "waiting"/default scope (e.g. it was decided since the notification was
  // sent), and the whole point of the deep-link is to still land on it.
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [type, setType] = useState("ALL");
  const [scope, setScope] = useState(highlightId ? "all" : mode === "inbox" ? "waiting" : "all");
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
  // Rejection always requires a stated reason -- revealed inline in place of
  // the row's action buttons (no modal), same for the bulk-reject toolbar
  // button. Enforced again server-side in decideWorkflowStep, this is just
  // the UX gate.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

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

  // Scroll the deep-linked card into view once its data has actually loaded.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`request-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, data]);

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

  function confirmReject(id: string) {
    const reason = rejectReason.trim();
    if (!reason) return;
    decide(id, "REJECT", { comments: reason });
    setRejectingId(null);
    setRejectReason("");
  }

  function confirmBulkReject() {
    const reason = bulkRejectReason.trim();
    if (!reason || !selectedIds.length) return;
    bulkMutation.mutate({ ids: selectedIds, decision: "REJECT", extra: { comments: reason } });
    setBulkRejecting(false);
    setBulkRejectReason("");
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
          {bulkRejecting ? (
            <div className="flex flex-1 min-w-[280px] items-center gap-2">
              <Input
                autoFocus
                value={bulkRejectReason}
                onChange={(event) => setBulkRejectReason(event.target.value)}
                placeholder="سبب الرفض (إجباري)..."
                className="h-9 flex-1"
              />
              <Button type="button" size="sm" variant="destructive" disabled={!bulkRejectReason.trim() || isPending} onClick={confirmBulkReject}>تأكيد الرفض</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setBulkRejecting(false); setBulkRejectReason(""); }}>إلغاء</Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="destructive" disabled={!selectedIds.length || isPending} onClick={() => setBulkRejecting(true)}>رفض المحدد</Button>
          )}
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

      {requests.length > 0 ? (
        <label className="flex w-fit items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">
          <input type="checkbox" checked={requests.length > 0 && selected.size === requests.length} onChange={(event) => setSelected(event.target.checked ? new Set(requests.map((request) => request.id)) : new Set())} />
          <span>تحديد الكل ({requests.length})</span>
        </label>
      ) : null}

      {/* Card-style request grid -- elegant rounded-3xl cards matching the
          profile-card aesthetic, replacing the old dense data table. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {requests.map((request) => (
          <Card
            key={request.id}
            id={`request-${request.id}`}
            className={cn("glass-card-premium relative overflow-hidden", request.id === highlightId && "ring-2 ring-primary ring-offset-2")}
          >
            <div className={cn("absolute inset-y-0 start-0 w-1.5", PRIORITY_ACCENT[request.priority?.toLowerCase()] ?? "bg-slate-300")} />
            <CardContent className="p-5 pe-5 ps-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={selected.has(request.id)}
                    onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(request.id); else next.delete(request.id); return next; })}
                  />
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white text-sm font-black">
                    {request.employee?.firstName?.charAt(0) || "?"}
                  </span>
                  <span className="min-w-0">
                    <p className="font-black text-slate-900 dark:text-slate-100 truncate">{request.employee?.firstName} {request.employee?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{request.employee?.employeeNumber}</p>
                  </span>
                </label>
                <Badge className={STATUS_BADGE[request.status] ?? "bg-slate-100 text-slate-700"}>
                  {STATUS_LABEL[request.status] ?? request.status}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-bold">{typeLabels[request.type] ?? request.type}</Badge>
                {request.employee?.department?.name ? <Badge variant="outline">{request.employee.department.name}</Badge> : null}
                {request.employee?.branch?.name ? <Badge variant="outline">{request.employee.branch.name}</Badge> : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 p-3">
                <div><p className="text-muted-foreground">تاريخ الإنشاء</p><p className="font-bold mt-0.5">{new Date(request.createdAt).toLocaleDateString("ar-SA")}</p></div>
                <div><p className="text-muted-foreground">آخر تحديث</p><p className="font-bold mt-0.5">{new Date(request.updatedAt).toLocaleDateString("ar-SA")}</p></div>
                <div><p className="text-muted-foreground">المعتمد الحالي</p><p className="font-bold mt-0.5 truncate">{request.currentApprover || "-"}</p></div>
                <div><p className="text-muted-foreground">الأولوية</p><p className="font-bold mt-0.5">{request.priority}</p></div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <Button type="button" size="sm" variant="outline" onClick={() => setTimelineWorkflowId(request.id)} disabled={isRowPending(request.id)}><History className="h-3.5 w-3.5" />السجل</Button>
                {/* Decision actions only make sense on a request that's actually
                    awaiting a decision right now -- the "all"/"decided" scopes
                    legitimately include already-APPROVED/REJECTED/RETURNED rows,
                    and calling decideWorkflowStep on those always fails with
                    "No pending workflow step" (there's nothing left to decide),
                    which read as "the button does nothing" from the UI. */}
                {isActionable(request) && rejectingId === request.id ? (
                  <div className="flex flex-1 min-w-full items-center gap-1.5 mt-1.5">
                    <Input
                      autoFocus
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="سبب الرفض (إجباري)..."
                      className="h-8 flex-1 text-xs"
                    />
                    <Button type="button" size="sm" variant="destructive" disabled={!rejectReason.trim() || isPending} onClick={() => confirmReject(request.id)}>
                      {isActionPending(request.id, "REJECT") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "تأكيد"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}>إلغاء</Button>
                  </div>
                ) : isActionable(request) ? (
                  <>
                    <Button type="button" size="sm" onClick={() => decide(request.id, "APPROVE")} disabled={isPending}>
                      {isActionPending(request.id, "APPROVE") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {isActionPending(request.id, "APPROVE") ? "جارٍ..." : "موافقة"}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => { setRejectingId(request.id); setRejectReason(""); }} disabled={isPending}>
                      <X className="h-3.5 w-3.5" />
                      رفض
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
                  <span className="px-1 py-1.5 text-xs text-muted-foreground">
                    {request.status !== "PENDING" ? "لا يوجد إجراء متاح (تم البت في الطلب)" : "لا يوجد إجراء متاح حالياً (الطلب مؤجل)"}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {requests.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-3xl border border-dashed p-12 text-center text-muted-foreground">
            {isFetching ? "جارِ التحميل..." : "لا توجد طلبات"}
          </div>
        ) : null}
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
