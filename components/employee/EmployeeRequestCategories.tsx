"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Eye, EyeOff, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NewRequestDialog } from "@/components/employee/NewRequestDialog";

const CATEGORY_LABELS: Record<string, string> = {
  ALL: "كل الأنواع",
  CUSTODY: "طلبات العهد",
  DELEGATION: "طلبات الانتدابات",
  DOCUMENT: "طلبات الوثائق",
  EXPENSE: "طلبات المصروفات",
  LEAVE: "طلبات الإجازات",
  LETTER: "طلبات الخطابات",
  LOAN: "طلبات السلف",
  OVERTIME: "طلبات الأوفر تايم",
  RESIDENCY: "طلبات الإقامة",
};

const CATEGORY_ORDER = ["ALL", "CUSTODY", "DELEGATION", "DOCUMENT", "EXPENSE", "LEAVE", "LETTER", "LOAN", "OVERTIME", "RESIDENCY"];

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "مقبول",
  COMPLETED: "مكتمل",
  REJECTED: "مرفوض",
  PENDING: "قيد الانتظار",
};

const STEP_STATUS_LABEL: Record<string, string> = {
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
  RETURNED: "أُرجع",
  PENDING: "قيد الانتظار",
  DEFERRED: "مؤجل",
};

type EmployeeRequest = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  currentApprover?: string;
};

type WorkflowStepDetail = {
  id: string;
  step: number;
  status: string;
  approvedAt: string | null;
  comments: string | null;
  viewedAt: string | null;
  approver: { id: string; name: string | null; email: string | null } | null;
};

type WorkflowDetail = {
  id: string;
  currentStep: number;
  steps: WorkflowStepDetail[];
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("ar-SA");
}

async function fetchRequests(type: string, search: string): Promise<EmployeeRequest[]> {
  const params = new URLSearchParams({ type, scope: "mine", sort: "newest", search, page: "1", pageSize: "50" });
  const response = await fetch(`/api/enterprise/requests?${params.toString()}`, { cache: "no-store" });
  const data = await response.json();
  if (!data.success) throw new Error(data.message || "فشل تحميل الطلبات");
  return data.requests ?? [];
}

function RequestRow({
  request,
  isOpen,
  onToggle,
  detail,
}: {
  request: EmployeeRequest;
  isOpen: boolean;
  onToggle: () => void;
  detail: WorkflowDetail | "loading" | "error" | undefined;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-3 text-start"
      >
        <div className="min-w-0">
          <p className="font-bold">{CATEGORY_LABELS[request.type] ?? request.type}</p>
          <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleDateString("ar-SA")}{request.currentApprover ? ` · المسؤول الحالي: ${request.currentApprover}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_BADGE[request.status] ?? "bg-slate-100 text-slate-700"}>
            {STATUS_LABEL[request.status] ?? request.status}
          </Badge>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen ? (
        <div className="mb-3 rounded-2xl border bg-muted/30 p-4">
          {detail === "loading" ? (
            <div className="space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ) : detail === "error" || !detail ? (
            <p className="text-sm text-rose-600">تعذر تحميل تفاصيل الموافقة</p>
          ) : (
            <ol className="space-y-3">
              {detail.steps.map((step) => (
                <li key={step.id} className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">المرحلة {step.step}{step.step === detail.currentStep ? " (الحالية)" : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.status === "PENDING" ? "بانتظار: " : step.status === "REJECTED" ? "رُفض من قِبل: " : "تمت الموافقة من: "}
                      {step.approver?.name ?? step.approver?.email ?? "لم يُحدد معتمد"}
                    </p>
                    {step.approvedAt ? <p className="text-xs text-muted-foreground">بتاريخ: {formatDateTime(step.approvedAt)}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge className={STATUS_BADGE[step.status] ?? "bg-slate-100 text-slate-700"}>
                      {STEP_STATUS_LABEL[step.status] ?? step.status}
                    </Badge>
                    {step.approver ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {step.viewedAt ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {step.viewedAt ? `شوهد بتاريخ ${formatDateTime(step.viewedAt)}` : "لم يُشاهد بعد"}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function EmployeeRequestCategories() {
  const [type, setType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkflowDetail | "loading" | "error">>({});

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["my-requests", type, search],
    queryFn: () => fetchRequests(type, search),
  });

  // Always-visible "last 3" snapshot, independent of the active filter/search,
  // so the quick preview doesn't disappear when the user is mid-filter.
  const { data: recentRequests = [] } = useQuery({
    queryKey: ["my-requests", "ALL", ""],
    queryFn: () => fetchRequests("ALL", ""),
  });
  const latestThree = useMemo(() => recentRequests.slice(0, 3), [recentRequests]);

  const toggleExpand = useCallback((requestId: string) => {
    setExpandedId((current) => {
      if (current === requestId) return null;
      return requestId;
    });
    setDetails((current) => {
      if (current[requestId]) return current;
      fetch(`/api/enterprise/workflows/${requestId}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (!data.success) throw new Error(data.message || "فشل تحميل تفاصيل الطلب");
          setDetails((prev) => ({ ...prev, [requestId]: data.workflow }));
        })
        .catch(() => setDetails((prev) => ({ ...prev, [requestId]: "error" })));
      return { ...current, [requestId]: "loading" };
    });
  }, []);

  const categories = useMemo(() => CATEGORY_ORDER, []);

  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>طلباتي</CardTitle>
        <Button type="button" size="sm" onClick={() => setNewRequestOpen(true)}>
          <Plus className="ms-1 h-4 w-4" />
          طلب جديد
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestThree.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">آخر الطلبات</p>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-primary">
                {showAll ? "عرض مختصر" : "عرض الكل"}
              </button>
            </div>
            {!showAll ? (
              <div className="divide-y rounded-2xl border">
                {latestThree.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{CATEGORY_LABELS[request.type] ?? request.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                    <Badge className={STATUS_BADGE[request.status] ?? "bg-slate-100 text-slate-700"}>
                      {STATUS_LABEL[request.status] ?? request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showAll || !latestThree.length ? (
          <>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <Button key={item} type="button" size="sm" variant={type === item ? "default" : "outline"} onClick={() => setType(item)}>
                  {CATEGORY_LABELS[item] ?? item}
                </Button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بطلباتي" className="pr-9" />
            </div>

            {error ? <div className="rounded-2xl border border-dashed p-4 text-sm text-rose-600">{(error as Error).message}</div> : null}

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">لا توجد طلبات ضمن هذا التصنيف</div>
            ) : (
              <div className="divide-y">
                {requests.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    isOpen={expandedId === request.id}
                    onToggle={() => toggleExpand(request.id)}
                    detail={details[request.id]}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </CardContent>

      <NewRequestDialog open={newRequestOpen} onOpenChange={setNewRequestOpen} />
    </Card>
  );
}
