"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 12_000;

type WorkflowStep = {
  id: string;
  step: number;
  status: string;
  approvedAt: string | null;
  comments: string | null;
  createdAt: string;
  approver: { id: string; name: string | null; email: string | null } | null;
};

type Workflow = {
  id: string;
  type: string;
  entityId: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  employee: { firstName: string; lastName: string; employeeNumber: string } | null;
  steps: WorkflowStep[];
};

const statusMeta: Record<string, { label: string; icon: typeof Check; className: string }> = {
  APPROVED: { label: "تمت الموافقة", icon: Check, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  REJECTED: { label: "مرفوض", icon: X, className: "bg-destructive/10 text-destructive border-destructive/30" },
  RETURNED: { label: "أُرجع", icon: RotateCcw, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  PENDING: { label: "قيد الانتظار", icon: Clock, className: "bg-primary/10 text-primary border-primary/30" },
  DEFERRED: { label: "مؤجل", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  WAITING: { label: "لم يصل بعد", icon: Clock, className: "bg-muted text-muted-foreground border-transparent" }
};

function formatDate(value: string | null, locale: "ar" | "en") {
  if (!value) return null;
  return new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
}

export function ApprovalTimeline({ workflowId, onClose, locale = "ar" }: { workflowId: string | null; onClose: () => void; locale?: "ar" | "en" }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/enterprise/workflows/${workflowId}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!data.success) {
          setError(data.message ?? "تعذر تحميل سجل الموافقات");
          return;
        }
        setWorkflow(data.workflow);
        setError(null);
      } catch {
        if (!cancelled) setError("تعذر تحميل سجل الموافقات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workflowId]);

  if (!workflowId) return null;

  return (
    <>
      <div className="drawer-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="سجل الموافقات"
        className={cn("fixed top-0 end-0 z-50 h-full w-full max-w-md", "bg-background border-s shadow-drawer", "animate-slide-in-right", "flex flex-col")}
        style={{ direction: locale === "ar" ? "rtl" : "ltr" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">سجل الموافقات</h2>
            {workflow?.employee ? (
              <p className="truncate text-xs text-muted-foreground">{workflow.employee.firstName} {workflow.employee.lastName} · {workflow.employee.employeeNumber}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && !workflow ? (
            <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" /> جاري التحميل...
            </div>
          ) : error && !workflow ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
          ) : workflow ? (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الحالة العامة للطلب</span>
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", statusMeta[workflow.status]?.className ?? "bg-muted text-muted-foreground")}>
                    {statusMeta[workflow.status]?.label ?? workflow.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">تم الإنشاء: {formatDate(workflow.createdAt, locale)}</p>
                <p className="text-xs text-muted-foreground">آخر تحديث: {formatDate(workflow.updatedAt, locale)}</p>
              </div>

              <ol className="space-y-4">
                {workflow.steps.map((step, index) => {
                  const meta = statusMeta[step.status] ?? statusMeta.WAITING;
                  const Icon = meta.icon;
                  const isCurrent = step.step === workflow.currentStep && step.status === "PENDING";
                  return (
                    <li key={step.id} className="relative ps-8">
                      {index < workflow.steps.length - 1 ? <span className="absolute start-[11px] top-6 h-full w-px bg-border" aria-hidden="true" /> : null}
                      <span className={cn("absolute start-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border", meta.className)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className={cn("rounded-xl border p-3", isCurrent ? "border-primary/40 bg-primary/5" : "bg-card")}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">المرحلة {step.step}{isCurrent ? " (الحالية)" : ""}</p>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.className)}>{meta.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{step.approver?.name ?? step.approver?.email ?? "لم يُحدد معتمد"}</p>
                        {step.approvedAt ? <p className="mt-1 text-xs text-muted-foreground">بتاريخ: {formatDate(step.approvedAt, locale)}</p> : null}
                        {step.comments ? <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-foreground">{step.comments}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
