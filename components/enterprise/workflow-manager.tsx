"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Check, X, CheckCircle2, Shield, Loader2, GitPullRequest, Eye, Trash2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

export type WorkflowStepItem = {
  id: number | string;
  approverId: string;
  approverLabel?: string;
  approverPosition?: string;
  orgUnitId: string;
  orgUnitLabel?: string;
  /** Legacy free-text field, no longer editable via the UI (superseded by
   * approverPosition) -- kept only so paths saved before the redesign keep
   * round-tripping their existing value instead of losing it on next save. */
  roleContext?: string;
};

type OrgUnit = { id: string; name: string };
type OrgUnits = { departments: OrgUnit[]; branches: OrgUnit[]; hospitals: OrgUnit[] };

const EMPTY_ORG_UNITS: OrgUnits = { departments: [], branches: [], hospitals: [] };

function orgUnitLabelFor(orgUnitId: string, units: OrgUnits): string {
  const [type, id] = orgUnitId.split(":");
  const list = type === "department" ? units.departments : type === "branch" ? units.branches : type === "hospital" ? units.hospitals : [];
  return list.find((u) => u.id === id)?.name ?? "";
}

const ACCENTS = {
  teal: {
    icon: "bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
    badge: "text-teal-700 border-teal-200 dark:text-teal-300",
    connector: "bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
    number: "bg-teal-600",
    ring: "hover:border-teal-300 dark:hover:border-teal-800",
    dashed: "border-teal-500/60 bg-teal-50/20 text-teal-700 hover:border-teal-600 hover:bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/20 dark:text-teal-300",
    save: "dark:bg-teal-600 dark:hover:bg-teal-700",
    focus: "focus:ring-teal-500"
  },
  violet: {
    icon: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
    badge: "text-violet-700 border-violet-200 dark:text-violet-300",
    connector: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
    number: "bg-violet-600",
    ring: "hover:border-violet-300 dark:hover:border-violet-800",
    dashed: "border-violet-500/60 bg-violet-50/20 text-violet-700 hover:border-violet-600 hover:bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-300",
    save: "dark:bg-violet-600 dark:hover:bg-violet-700",
    focus: "focus:ring-violet-500"
  }
} as const;

interface WorkflowManagerProps {
  initialSteps?: WorkflowStepItem[];
  moduleName?: string;
  accent?: keyof typeof ACCENTS;
  onSave?: (steps: WorkflowStepItem[]) => Promise<void> | void;
}

function emptyStep(): WorkflowStepItem {
  return { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, approverId: "", orgUnitId: "" };
}

/** Small "i" trigger for a guiding tooltip -- same interaction pattern as
 * PermissionHint in the Permissions system (click-to-toggle, not just
 * hover), for visual/behavioral harmony between the two admin surfaces. */
function StepHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); setOpen((v) => !v); }}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
            aria-label={text}
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="w-56 p-2.5 text-[11px]">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Dedicated "View" control -- read-only approver details (name + job title +
 * org unit), separate from Edit so opening it never risks changing data. */
function ApproverViewButton({ step, orgUnits }: { step: WorkflowStepItem; orgUnits: OrgUnits }) {
  const [open, setOpen] = useState(false);
  if (!step.approverId) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="عرض تفاصيل المسؤول"
            aria-label="View"
          >
            <Eye className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="w-60 p-3">
          <strong className="mb-1 block font-bold text-slate-100">{step.approverLabel || "—"}</strong>
          <span className="block text-slate-300">{step.approverPosition || "بدون مسمى وظيفي"}</span>
          <span className="mt-1 block border-t border-slate-700 pt-1 text-slate-400">{step.orgUnitLabel || orgUnitLabelFor(step.orgUnitId, orgUnits) || "بدون جهة"}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WorkflowManager({
  initialSteps = [],
  moduleName = "إجازات الموظفين (Leave Requests)",
  accent = "teal",
  onSave
}: WorkflowManagerProps) {
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [editingIds, setEditingIds] = useState<Set<string | number>>(new Set());
  const [confirmingDeleteIds, setConfirmingDeleteIds] = useState<Set<string | number>>(new Set());
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const theme = ACCENTS[accent];

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/enterprise/workflow-paths/org-units", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) setOrgUnits({ departments: data.departments ?? [], branches: data.branches ?? [], hospitals: data.hospitals ?? [] });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function setEditing(id: number | string, value: boolean) {
    setEditingIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setConfirmingDelete(id: number | string, value: boolean) {
    setConfirmingDeleteIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const hasIncompleteStep = steps.some((step) => !step.approverId || !step.orgUnitId);

  function addStepAfter(id: number | string | null) {
    if (hasIncompleteStep) return;
    const step = emptyStep();
    setSteps((current) => {
      if (id === null) return [...current, step];
      const index = current.findIndex((s) => s.id === id);
      if (index === -1) return [...current, step];
      return [...current.slice(0, index + 1), step, ...current.slice(index + 1)];
    });
    setEditing(step.id, true);
  }

  function removeStep(id: number | string) {
    setSteps((current) => current.filter((s) => s.id !== id));
    setEditing(id, false);
    setConfirmingDelete(id, false);
  }

  function updateStep(id: number | string, patch: Partial<WorkflowStepItem>) {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  const handleSave = () => {
    setMessage("");
    if (hasIncompleteStep) {
      setMessage("أكمل اختيار الجهة والمسؤول لكل المستويات قبل الحفظ");
      return;
    }
    startTransition(async () => {
      try {
        if (onSave) await onSave(steps);
        setMessage("تم حفظ مسار الطلب وتحديث التسلسل الإداري بنجاح");
        setEditingIds(new Set());
      } catch (err: any) {
        setMessage(err.message || "حدث خطأ أثناء حفظ المسار");
      }
    });
  };

  return (
    <Card className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" dir="rtl">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-xs ${theme.icon}`}>
              <GitPullRequest className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">إعداد مسار الطلب والتسلسل الإداري</CardTitle>
              <CardDescription className="mt-0.5 font-mono text-xs text-muted-foreground">{moduleName}</CardDescription>
            </div>
          </div>
          <Badge key={steps.length} variant="outline" className={`rounded-xl bg-white px-2.5 py-1 text-xs font-bold dark:bg-slate-900 ${theme.badge}`}>
            {steps.length} مستويات
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {message ? (
          <div className={`flex items-center gap-2 rounded-2xl p-3.5 text-xs font-semibold ${
            message.includes("بنجاح")
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        {steps.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-950/30">
            لا توجد مستويات اعتماد بعد. أضف أول مستوى للبدء في بناء المسار.
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => {
              const editing = editingIds.has(step.id);
              const confirmingDelete = confirmingDeleteIds.has(step.id);
              const canConfirm = Boolean(step.approverId && step.orgUnitId);
              return (
                <div key={step.id} className="flex flex-col items-stretch">
                  <div className={`relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs transition-all dark:border-slate-800 dark:bg-slate-900/40 ${theme.ring}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span key={`num-${index}`} className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black text-white shadow-xs ${theme.number}`}>
                          {index + 1}
                        </span>
                        <span key={`label-${index}`} className="text-xs font-bold text-slate-700 dark:text-slate-300">المستوى {index + 1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ApproverViewButton step={step} orgUnits={orgUnits} />
                        <button
                          type="button"
                          onClick={() => setEditing(step.id, !editing)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-primary/8 hover:text-primary dark:hover:bg-primary/40"
                          title="تعديل الجهة أو المسؤول لهذا المستوى"
                          aria-label="Edit"
                        >
                          {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </button>
                        {confirmingDelete ? (
                          <div className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-1 py-0.5 dark:border-rose-900 dark:bg-rose-950/30">
                            <span className="px-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300">تأكيد؟</span>
                            <button type="button" onClick={() => removeStep(step.id)} className="rounded-lg p-1 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40" aria-label="Confirm delete"><Check className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setConfirmingDelete(step.id, false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(step.id, true)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            title="حذف هذا المستوى"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {editing ? (
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="block text-[10px] font-bold text-muted-foreground">١. الجهة (النطاق الرئيسي)</label>
                            {!step.orgUnitId ? <StepHint text="اختر الجهة أولاً -- هي المفتاح الرئيسي لهذا المستوى، ويُحدَّد المسؤول بعدها." /> : null}
                          </div>
                          <select
                            value={step.orgUnitId}
                            onChange={(e) => updateStep(step.id, { orgUnitId: e.target.value, orgUnitLabel: orgUnitLabelFor(e.target.value, orgUnits) })}
                            className={`h-9 w-full rounded-xl border border-input bg-white px-3 text-xs font-medium dark:bg-slate-900 focus:ring-2 ${theme.focus}`}
                          >
                            <option value="">اختر الجهة...</option>
                            {orgUnits.departments.length ? (
                              <optgroup label="الإدارات">
                                {orgUnits.departments.map((d) => <option key={d.id} value={`department:${d.id}`}>{d.name}</option>)}
                              </optgroup>
                            ) : null}
                            {orgUnits.branches.length ? (
                              <optgroup label="الفروع">
                                {orgUnits.branches.map((b) => <option key={b.id} value={`branch:${b.id}`}>{b.name}</option>)}
                              </optgroup>
                            ) : null}
                            {orgUnits.hospitals.length ? (
                              <optgroup label="المستشفيات">
                                {orgUnits.hospitals.map((h) => <option key={h.id} value={`hospital:${h.id}`}>{h.name}</option>)}
                              </optgroup>
                            ) : null}
                          </select>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="block text-[10px] font-bold text-muted-foreground">٢. المسؤول (المعتمِد)</label>
                            {step.orgUnitId && !step.approverId ? <StepHint text="اختر الموظف الذي سيعتمد طلبات هذه الجهة." /> : null}
                          </div>
                          <div className={!step.orgUnitId ? "pointer-events-none opacity-50" : ""}>
                            <UserSearchSelect
                              value={step.approverId}
                              initialLabel={step.approverLabel ?? ""}
                              onChange={(userId, label, employee) => updateStep(step.id, { approverId: userId, approverLabel: label ?? "", approverPosition: employee?.position?.title ?? "" })}
                              placeholder={step.orgUnitId ? "ابحث عن الموظف بالاسم أو الرقم الوظيفي أو الهوية..." : "اختر الجهة أولاً"}
                            />
                          </div>
                        </div>
                        {canConfirm ? (
                          <Button type="button" size="sm" onClick={() => setEditing(step.id, false)} className="h-8 rounded-lg text-xs">
                            <Check className="h-3.5 w-3.5" /> تم
                          </Button>
                        ) : (
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">أكمل اختيار الجهة والمسؤول لهذا المستوى.</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {step.orgUnitLabel || step.orgUnitId ? (
                          <Badge variant="outline" className="rounded-lg text-[11px] font-semibold">{step.orgUnitLabel || orgUnitLabelFor(step.orgUnitId, orgUnits)}</Badge>
                        ) : null}
                        <span className="font-bold text-slate-800 dark:text-slate-200">{step.approverLabel || "لم يتم اختيار المسؤول"}</span>
                        {step.approverPosition ? <span className="text-muted-foreground">{step.approverPosition}</span> : null}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center py-1.5">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <button
                              type="button"
                              onClick={() => addStepAfter(step.id)}
                              disabled={hasIncompleteStep}
                              className={`flex h-7 w-7 items-center justify-center rounded-full shadow-2xs transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${theme.connector}`}
                              aria-label="Add step after"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">
                          {hasIncompleteStep ? "أكمل المستوى الحالي أولاً قبل إضافة مستوى جديد" : "إضافة مستوى اعتماد جديد بعد هذا المستوى"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 pt-2">
          {steps.length === 0 ? (
            <Button
              type="button"
              onClick={() => addStepAfter(null)}
              variant="outline"
              className={`h-11 w-full gap-2 rounded-2xl border-2 border-dashed font-bold shadow-2xs ${theme.dashed}`}
            >
              <Plus className="h-5 w-5" />
              <span>إضافة أول مستوى اعتماد</span>
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || steps.length === 0 || hasIncompleteStep}
            className={`h-12 w-full gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg hover:bg-slate-800 ${theme.save}`}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 text-white/80" />}
            <span>حفظ إعدادات مسار الاعتماد</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
