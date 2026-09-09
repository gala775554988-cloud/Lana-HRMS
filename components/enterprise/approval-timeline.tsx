"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, ExternalLink, FileText, Loader2, RotateCcw, Timer, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseWorkflowStepMetadata } from "@/lib/enterprise/workflow-step-metadata";

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
  details: {
    title: string;
    reference: string;
    status: string;
    fields: Array<{ label: string; value: string | number | null; tone?: "default" | "money" | "date" | "duration" }>;
    attachments: Array<{ name: string; url: string }>;
  } | null;
  serviceLevel: { name: string; hours: number; dueAt: string; overdue: boolean; deferredUntil: string | null };
  audit: Array<{ id: string; action: string; createdAt: string; actor: string }>;
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

function formatField(field: NonNullable<Workflow["details"]>["fields"][number]) {
  if (field.value === null || field.value === "") return "—";
  if (field.tone === "date") return new Date(String(field.value)).toLocaleDateString("ar-SA");
  if (field.tone === "money") return `${Number(field.value).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
  if (field.tone === "duration") return `${field.value} ساعة/يوم`;
  return String(field.value);
}

const auditLabels: Record<string, string> = {
  "workflow:approve": "اعتماد المرحلة",
  "workflow:reject": "رفض الطلب",
  "workflow:return": "إرجاع الطلب للتعديل",
  "workflow:transfer": "تحويل الطلب",
  "workflow:defer": "تأجيل الطلب",
  "workflow:note": "إضافة ملاحظة",
  "workflow:priority": "تغيير الأولوية"
};

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
        className={cn("fixed top-0 end-0 z-50 h-full w-full max-w-2xl", "bg-background border-s shadow-drawer", "animate-slide-in-right", "flex flex-col")}
        style={{ direction: locale === "ar" ? "rtl" : "ltr" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">تفاصيل الطلب وسجل الموافقات</h2>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4 text-primary" />{workflow.details?.title ?? workflow.type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">رقم المرجع: {workflow.details?.reference ?? workflow.entityId}</p>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", statusMeta[workflow.status]?.className ?? "bg-muted text-muted-foreground")}>
                    {statusMeta[workflow.status]?.label ?? workflow.status}
                  </span>
                </div>
                {workflow.details?.fields?.length ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {workflow.details.fields.map((field, index) => (
                      <div key={`${field.label}-${index}`} className="rounded-lg bg-muted/45 px-3 py-2.5">
                        <dt className="text-[11px] text-muted-foreground">{field.label}</dt>
                        <dd className="mt-1 text-sm font-semibold text-foreground">{formatField(field)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {workflow.details?.attachments?.length ? (
                  <div className="mt-3 space-y-2">
                    {workflow.details.attachments.map((attachment) => (
                      <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50">
                        {attachment.name}<ExternalLink className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={cn("rounded-xl border p-4", workflow.serviceLevel.overdue ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20" : "bg-card")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-bold"><Timer className="h-4 w-4" />مدة المعالجة</p>
                  <span className={cn("text-xs font-bold", workflow.serviceLevel.overdue ? "text-rose-600" : "text-emerald-600")}>
                    {workflow.serviceLevel.overdue ? "متجاوز للمدة" : "ضمن المدة"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>المعيار: {workflow.serviceLevel.hours} ساعة</span>
                  <span>الاستحقاق: {formatDate(workflow.serviceLevel.dueAt, locale)}</span>
                </div>
              </div>

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
                  const details = parseWorkflowStepMetadata(step.comments);
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
                        {details.priority ? <p className="mt-1 text-xs text-muted-foreground">الأولوية: {details.priority === "High" ? "عالية" : details.priority === "Low" ? "منخفضة" : "عادية"}</p> : null}
                        {details.deferredUntil ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">مؤجل حتى: {formatDate(details.deferredUntil, locale)}</p> : null}
                        {details.transferred ? <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">تم تحويل هذه المرحلة إلى معتمد آخر</p> : null}
                        {details.note ? <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-foreground">{details.note}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="rounded-xl border bg-card p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold"><UserRound className="h-4 w-4" />سجل العمليات</p>
                {workflow.audit.length ? (
                  <div className="space-y-2">
                    {workflow.audit.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/45 px-3 py-2 text-xs">
                        <div><p className="font-semibold">{auditLabels[item.action] ?? item.action}</p><p className="text-muted-foreground">{item.actor}</p></div>
                        <time className="shrink-0 text-muted-foreground">{formatDate(item.createdAt, locale)}</time>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">لا توجد عمليات مسجلة بعد.</p>}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
