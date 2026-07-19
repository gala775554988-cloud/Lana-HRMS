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
  roleContext?: string;
};

type OrgUnit = { id: string; name: string };
type OrgUnits = { departments: OrgUnit[]; branches: OrgUnit[]; hospitals: OrgUnit[] };

const EMPTY_ORG_UNITS: OrgUnits = { departments: [], branches: [], hospitals: [] };

function orgUnitLabelFor(orgUnitId: string, units: OrgUnits): string {
  if (!orgUnitId || !orgUnitId.includes(":")) return "";
  const [type, id] = orgUnitId.split(":");
  const list = type === "department" ? units.departments : type === "branch" ? units.branches : type === "hospital" ? units.hospitals : [];
  return list.find((u) => u.id === id)?.name ?? "";
}

const ACCENTS = {
  teal: {
    headerBg: "bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white",
    icon: "bg-teal-500/20 text-teal-300 border border-teal-400/30",
    badge: "bg-teal-500/20 text-teal-200 border-teal-400/30",
    tableHeader: "bg-teal-50/80 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 border-b border-teal-200/60 dark:border-teal-800",
    connector: "bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/25",
    number: "bg-teal-600 text-white font-black",
    ring: "hover:border-teal-400 dark:hover:border-teal-700",
    saveBtn: "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black shadow-lg shadow-teal-600/25 h-11 px-6 rounded-2xl"
  },
  violet: {
    headerBg: "bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white",
    icon: "bg-violet-500/20 text-violet-300 border border-violet-400/30",
    badge: "bg-violet-500/20 text-violet-200 border-violet-400/30",
    tableHeader: "bg-violet-50/80 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200 border-b border-violet-200/60 dark:border-violet-800",
    connector: "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/25",
    number: "bg-violet-600 text-white font-black",
    ring: "hover:border-violet-400 dark:hover:border-violet-700",
    saveBtn: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black shadow-lg shadow-violet-600/25 h-11 px-6 rounded-2xl"
  }
} as const;

interface WorkflowManagerProps {
  initialSteps?: WorkflowStepItem[];
  moduleName?: string;
  onSave?: (steps: WorkflowStepItem[]) => Promise<void> | void;
  accent?: "teal" | "violet";
  defaultOrgScopeType?: "hospital" | "branch" | "department";
}

function emptyStep(defaultOrgType = ""): WorkflowStepItem {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    approverId: "",
    orgUnitId: defaultOrgType ? `${defaultOrgType}:` : "",
    approverPosition: "مستوى موافقة مخصص / معتمِد",
    orgUnitLabel: defaultOrgType === "hospital" ? "المستشفيات / القطاع الطبي" : "الإدارة / الفرع التشغيلي",
    roleContext: "CUSTOM_APPROVER"
  };
}

export function WorkflowManager({ initialSteps = [], moduleName = "المسار المعتمد", onSave, accent = "teal", defaultOrgScopeType }: WorkflowManagerProps) {
  const theme = ACCENTS[accent] ?? ACCENTS.teal;
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [editingIds, setEditingIds] = useState<Set<number | string>>(new Set());
  const [confirmingDeleteIds, setConfirmingDeleteIds] = useState<Set<number | string>>(new Set());
  const [viewingStep, setViewingStep] = useState<WorkflowStepItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialSteps || initialSteps.length === 0) {
      setSteps([emptyStep(defaultOrgScopeType)]);
    } else {
      setSteps(initialSteps);
    }
  }, [initialSteps, defaultOrgScopeType]);

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

  const addStep = () => {
    const step = emptyStep(defaultOrgScopeType);
    setSteps((current) => [...current, step]);
    setEditingIds((current) => new Set(current).add(step.id));
  };

  const removeStep = (id: number | string) => {
    setSteps((current) => current.filter((s) => s.id !== id));
    setEditingIds((current) => { const next = new Set(current); next.delete(id); return next; });
    setConfirmingDeleteIds((current) => { const next = new Set(current); next.delete(id); return next; });
  };

  const updateStep = (id: number | string, patch: Partial<WorkflowStepItem>) => {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const toggleEditing = (id: number | string) => {
    setEditingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        if (onSave) await onSave(steps);
        setMessage("✓ تم حفظ إعدادات وتسلسل المسار الإداري والموافقات بنجاح 100%");
        setEditingIds(new Set());
      } catch (err: any) {
        setMessage(`⚠️ ${err.message || "حدث خطأ أثناء حفظ الإعدادات"}`);
      }
    });
  };

  return (
    <Card className="w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900" dir="rtl">
      {/* Header Bar */}
      <div className={`p-6 ${theme.headerBg} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3.5">
          <div className={`grid h-12 w-12 place-items-center rounded-2xl ${theme.icon} shadow-inner`}>
            <GitPullRequest className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">{moduleName}</h2>
            <p className="text-xs text-white/75 font-semibold mt-0.5">جدول التسلسل الهرمي للمعتمدين — أضف أو عدّل الموظفين بالترتيب المطلوب</p>
          </div>
        </div>
        <Badge className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs ${theme.badge}`}>
          {steps.length} مستوى في السلسلة
        </Badge>
      </div>

      <CardContent className="p-6 space-y-6">
        {message ? (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            message.startsWith("✓") 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            <span>{message}</span>
          </div>
        ) : null}

        {/* Modern Professional Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className={theme.tableHeader}>
              <tr>
                <th className="py-3.5 px-4 font-extrabold w-20 text-center">الترتيب</th>
                <th className="py-3.5 px-4 font-extrabold w-64">الجهة / النطاق التشغيلي</th>
                <th className="py-3.5 px-4 font-extrabold">الموظف المعتمِد والمرحلة الوظيفية</th>
                <th className="py-3.5 px-4 font-extrabold w-44 text-center">الإجراءات (عرض/تعديل/حذف)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60">
              {steps.map((step, index) => {
                const editing = editingIds.has(step.id);
                const confirmingDelete = confirmingDeleteIds.has(step.id);
                return (
                  <tr key={step.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-4 text-center align-top pt-5">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs ${theme.number}`}>
                        {index + 1}
                      </span>
                    </td>

                    {/* Org Unit Column */}
                    <td className="py-4 px-4 align-top pt-5">
                      {editing ? (
                        <select
                          value={step.orgUnitId}
                          onChange={(e) => updateStep(step.id, { orgUnitId: e.target.value, orgUnitLabel: orgUnitLabelFor(e.target.value, orgUnits) })}
                          className="h-10 w-full rounded-xl border border-input bg-white dark:bg-slate-950 px-3 text-xs font-bold shadow-2xs focus:ring-2 focus:ring-primary"
                        >
                          <option value="">اختر النطاق التشغيلي...</option>
                          {orgUnits.hospitals.length ? (
                            <optgroup label="المستشفيات / القطاع الطبي">
                              {orgUnits.hospitals.map((h) => <option key={h.id} value={`hospital:${h.id}`}>{h.name}</option>)}
                            </optgroup>
                          ) : null}
                          {orgUnits.branches.length ? (
                            <optgroup label="الفروع">
                              {orgUnits.branches.map((b) => <option key={b.id} value={`branch:${b.id}`}>{b.name}</option>)}
                            </optgroup>
                          ) : null}
                          {orgUnits.departments.length ? (
                            <optgroup label="الإدارات">
                              {orgUnits.departments.map((d) => <option key={d.id} value={`department:${d.id}`}>{d.name}</option>)}
                            </optgroup>
                          ) : null}
                        </select>
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {step.orgUnitLabel || orgUnitLabelFor(step.orgUnitId, orgUnits) || (defaultOrgScopeType === "hospital" ? "المستشفيات / القطاع الطبي" : "الإدارة / الفرع التشغيلي")}
                        </span>
                      )}
                    </td>

                    {/* Approver Employee Column */}
                    <td className="py-4 px-4 align-top">
                      {editing ? (
                        <div className="space-y-2.5">
                          <UserSearchSelect
                            value={step.approverId}
                            initialLabel={step.approverLabel ?? ""}
                            onChange={(userId, label, employee) => updateStep(step.id, { approverId: userId, approverLabel: label ?? "", approverPosition: employee?.position?.title || step.approverPosition || "" })}
                            placeholder="ابحث عن الموظف بالاسم أو الهوية أو الرقم الوظيفي..."
                          />
                          {step.approverPosition ? (
                            <div className="text-[11px] font-extrabold text-primary flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/15">
                              <span>🎯 دور / مرحلة الاعتماد المطلوب:</span>
                              <span>{step.approverPosition}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            {step.approverId && step.approverLabel ? (
                              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>شخص محدد: {step.approverLabel}</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-400/80 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                                <span>⚠️ حقل الموظف فارغ ونظيف — اضغط أيقونة التعديل ✏️ لاختيار الموظف المعتمِد</span>
                              </Badge>
                            )}
                          </div>
                          {step.approverPosition ? (
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>المرحلة / الصلاحية: {step.approverPosition}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Actions Column (View / Edit / Delete) */}
                    <td className="py-4 px-4 text-center align-top pt-5">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setViewingStep(step)}
                          title="عرض تفاصيل المستوى والصلاحيات"
                        >
                          <Eye className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-8 w-8 rounded-xl ${editing ? "bg-primary/10 text-primary" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                          onClick={() => toggleEditing(step.id)}
                          title="تعديل هذا المستوى واختيار الموظف"
                        >
                          {editing ? <Check className="h-4 w-4 text-emerald-600" /> : <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
                        </Button>

                        {confirmingDelete ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 p-1 rounded-xl border border-rose-200 dark:border-rose-800">
                            <button onClick={() => removeStep(step.id)} className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold">حذف</button>
                            <button onClick={() => setConfirmingDeleteIds(new Set())} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            onClick={() => setConfirmingDeleteIds((c) => new Set(c).add(step.id))}
                            title="حذف هذا المستوى من السلسلة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions (`+ إضافة حقل` & `💾 حفظ الإعدادات`) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            onClick={addStep}
            variant="outline"
            className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 font-extrabold text-xs h-11 px-5 gap-2 hover:border-primary hover:text-primary w-full sm:w-auto shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ إضافة حقل / موظف جديد في التسلسل</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={`w-full sm:w-auto ${theme.saveBtn}`}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
            <span>💾 حفظ إعدادات وتسلسل {moduleName}</span>
          </Button>
        </div>
      </CardContent>

      {/* View Step Details Modal */}
      {viewingStep ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800" dir="rtl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">تفاصيل مستوى الاعتماد</h3>
              <button onClick={() => setViewingStep(null)} className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-xs font-semibold">
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <span className="text-muted-foreground">النطاق / الجهة:</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100">{viewingStep.orgUnitLabel || orgUnitLabelFor(viewingStep.orgUnitId, orgUnits) || "عام"}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <span className="text-muted-foreground">الموظف المعتمِد:</span>
                <span className="font-extrabold text-primary">{viewingStep.approverLabel || "حقل فارغ (لم يتم الاختيار بعد)"}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <span className="text-muted-foreground">المرحلة / الدور:</span>
                <span className="font-bold">{viewingStep.approverPosition || "—"}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button onClick={() => setViewingStep(null)} className="rounded-xl px-6 font-bold text-xs">إغلاق</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
