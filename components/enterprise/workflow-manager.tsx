"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Check, X, CheckCircle2, Shield, Loader2, GitPullRequest, Eye, Trash2, HelpCircle, Layers, FileText, UserCheck, Building2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const REQUEST_TYPE_OPTIONS = [
  { id: "ALL", label: "جميع الطلبات (شامل)", icon: Layers },
  { id: "LEAVE", label: "طلب إجازة", icon: FileText },
  { id: "RESUMPTION", label: "طلب المباشرة", icon: UserCheck },
  { id: "OVERTIME", label: "العمل الإضافي", icon: FileText },
  { id: "LOAN", label: "السلف والقروض", icon: FileText },
  { id: "EXPENSE", label: "المصاريف والعُهد", icon: FileText }
];

const ACCENTS = {
  teal: {
    headerBg: "bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 text-white",
    icon: "bg-teal-500/20 text-teal-300 border border-teal-400/30",
    badge: "bg-teal-500/20 text-teal-200 border-teal-400/30",
    tableHeader: "bg-teal-100/80 dark:bg-teal-950/70 text-teal-950 dark:text-teal-200 border-b-2 border-teal-300 dark:border-teal-800 font-black",
    number: "bg-teal-600 text-white font-black",
    saveBtn: "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black shadow-md shadow-teal-600/25 h-11 px-8 rounded-xl text-sm"
  },
  violet: {
    headerBg: "bg-gradient-to-r from-violet-950 via-indigo-900 to-slate-900 text-white",
    icon: "bg-violet-500/20 text-violet-300 border border-violet-400/30",
    badge: "bg-violet-500/20 text-violet-200 border-violet-400/30",
    tableHeader: "bg-violet-100/80 dark:bg-violet-950/70 text-violet-950 dark:text-violet-200 border-b-2 border-violet-300 dark:border-violet-800 font-black",
    number: "bg-violet-600 text-white font-black",
    saveBtn: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black shadow-md shadow-violet-600/25 h-11 px-8 rounded-xl text-sm"
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
    approverPosition: "حقل مستوى موافقة مخصص",
    orgUnitLabel: defaultOrgType === "hospital" ? "المستشفيات / القطاع الطبي" : "الإدارة / الفرع التشغيلي",
    roleContext: "CUSTOM_APPROVER"
  };
}

export function WorkflowManager({ initialSteps = [], moduleName = "المسار المعتمد", onSave, accent = "teal", defaultOrgScopeType }: WorkflowManagerProps) {
  const theme = ACCENTS[accent] ?? ACCENTS.teal;
  const isHospital = defaultOrgScopeType === "hospital";
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [editingIds, setEditingIds] = useState<Set<number | string>>(new Set());
  const [confirmingDeleteIds, setConfirmingDeleteIds] = useState<Set<number | string>>(new Set());
  const [viewingStep, setViewingStep] = useState<WorkflowStepItem | null>(null);
  const [selectedRequestTypes, setSelectedRequestTypes] = useState<string[]>(["ALL", "LEAVE", "RESUMPTION", "OVERTIME", "LOAN", "EXPENSE"]);
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

  const toggleRequestType = (typeId: string) => {
    if (typeId === "ALL") {
      if (selectedRequestTypes.includes("ALL")) setSelectedRequestTypes([]);
      else setSelectedRequestTypes(["ALL", "LEAVE", "RESUMPTION", "OVERTIME", "LOAN", "EXPENSE"]);
      return;
    }
    setSelectedRequestTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
        next.delete("ALL");
      } else {
        next.add(typeId);
        if (next.size >= 5) next.add("ALL");
      }
      return Array.from(next);
    });
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        if (onSave) await onSave(steps);
        setMessage("✓ تم حفظ إعدادات وتسلسل الطلبات في هذا الجدول المُرتب بنجاح 100%");
        setEditingIds(new Set());
      } catch (err: any) {
        setMessage(`⚠️ ${err.message || "حدث خطأ أثناء حفظ الإعدادات"}`);
      }
    });
  };

  return (
    <Card className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900" dir="rtl">
      {/* Sleek Compact Header */}
      <div className={`px-5 py-4 ${theme.headerBg} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${theme.icon} shadow-inner shrink-0`}>
            {isHospital ? <Building2 className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-black">{moduleName}</h2>
            <p className="text-xs text-white/80 font-semibold">
              جدول واحد مُرتب بفراغات منظمة — الفراغ الأول لاختيار {isHospital ? "المستشفى" : "الإدارة/الفرع"}، ثم الفراغ الثاني لاختيار المشرف، ثم إضافة حقل
            </p>
          </div>
        </div>
        <Badge className={`px-3 py-1 rounded-lg font-mono font-bold text-xs ${theme.badge}`}>
          {steps.length} حقول في الجدول
        </Badge>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Sleek Compact Inline Request Types Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-200">📌 نوع الطلب المرتبط بهذا المسار:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {REQUEST_TYPE_OPTIONS.map((opt) => {
              const active = selectedRequestTypes.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleRequestType(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition border ${
                    active
                      ? "bg-primary text-white border-primary shadow-2xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-primary/50"
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {message ? (
          <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            message.startsWith("✓") 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            <span>{message}</span>
          </div>
        ) : null}

        {/* The One Neat, Compact Table (`جدول واحد مرتب بفراغات مرتبه ليس بهذا الشكل الكبير المفرط`) */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <table className="w-full text-right text-xs">
            <thead className={theme.tableHeader}>
              <tr>
                <th className="py-3 px-3.5 font-black w-24 text-center">المستوى</th>
                <th className="py-3 px-3.5 font-black w-64">الفراغ / حقل النطاق والجهة ({isHospital ? "المستشفى" : "الإدارة/الفرع"})</th>
                <th className="py-3 px-3.5 font-black">حقل اختيار المشرف / الموظف المعتمِد (`اختر أنا الموظف`)</th>
                <th className="py-3 px-3.5 font-black w-40 text-center">أزرار: عرض | تعديل | حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60">
              {steps.map((step, index) => {
                const editing = editingIds.has(step.id);
                const confirmingDelete = confirmingDeleteIds.has(step.id);
                const isAssigned = Boolean(step.approverId);
                const isFirstRow = index === 0;
                const isSecondRow = index === 1;

                return (
                  <tr key={step.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Level Badge */}
                    <td className="py-3.5 px-3.5 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs ${theme.number}`}>
                          {index + 1}
                        </span>
                        <span className="text-[10px] font-extrabold text-muted-foreground">
                          {isFirstRow ? (isHospital ? "المستشفى" : "الفرع/الإدارة") : isSecondRow ? "المشرف/المدير" : `مستوى ${index + 1}`}
                        </span>
                      </div>
                    </td>

                    {/* Column 2: The First Blank/Field (`الفراغ الأول حقل لاختيار المستشفى / الإدارة`) */}
                    <td className="py-3.5 px-3.5 align-middle">
                      {editing || !step.orgUnitId ? (
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-primary block">
                            {isFirstRow ? (isHospital ? "👈 الفراغ الأول: حقل لاختيار المستشفى:" : "👈 الفراغ الأول: حقل لاختيار الإدارة أو الفرع:") : `اختر نطاق جهة المستوى ${index + 1}:`}
                          </label>
                          <select
                            value={step.orgUnitId}
                            onChange={(e) => updateStep(step.id, { orgUnitId: e.target.value, orgUnitLabel: orgUnitLabelFor(e.target.value, orgUnits) })}
                            className="h-9 w-full rounded-xl border border-input bg-white dark:bg-slate-950 px-2.5 text-xs font-bold shadow-2xs focus:ring-2 focus:ring-primary"
                          >
                            <option value="">-- اختر {isHospital ? "المستشفى من القائمة..." : "الفرع أو الإدارة من القائمة..."} --</option>
                            {orgUnits.hospitals.length ? (
                              <optgroup label="🏥 المستشفيات / القطاع الطبي">
                                {orgUnits.hospitals.map((h) => <option key={h.id} value={`hospital:${h.id}`}>{h.name}</option>)}
                              </optgroup>
                            ) : null}
                            {orgUnits.branches.length ? (
                              <optgroup label="🏢 الفروع التشغيلية">
                                {orgUnits.branches.map((b) => <option key={b.id} value={`branch:${b.id}`}>{b.name}</option>)}
                              </optgroup>
                            ) : null}
                            {orgUnits.departments.length ? (
                              <optgroup label="📋 الإدارات العامة">
                                {orgUnits.departments.map((d) => <option key={d.id} value={`department:${d.id}`}>{d.name}</option>)}
                              </optgroup>
                            ) : null}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-100/80 dark:bg-slate-800/80 p-2 rounded-xl border">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">
                            {step.orgUnitLabel || orgUnitLabelFor(step.orgUnitId, orgUnits) || (isHospital ? "جميع المستشفيات" : "الإدارة / الفرع")}
                          </span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => toggleEditing(step.id)} title="تغيير الجهة / المستشفى">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>

                    {/* Column 3: The Second Blank/Field (`حقل لاختيار مشرف / اختيار أنا الموظف`) */}
                    <td className="py-3.5 px-3.5 align-middle">
                      {editing || !isAssigned ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-extrabold text-primary flex items-center gap-1">
                              <span>{isSecondRow ? "👈 الفراغ الثاني: حقل لاختيار مشرف (`اختر أنا الموظف`):" : isFirstRow ? "👈 اختيار ممثل/منسق الجهة أو اتركه تلقائي:" : `👈 اختيار الموظف المعتمِد للمستوى ${index + 1}:`}</span>
                            </label>
                          </div>
                          <UserSearchSelect
                            value={step.approverId}
                            initialLabel={step.approverLabel ?? ""}
                            onChange={(userId, label, employee) => {
                              updateStep(step.id, {
                                approverId: userId,
                                approverLabel: label ?? "",
                                approverPosition: employee?.position?.title || step.approverPosition || ""
                              });
                            }}
                            placeholder={isSecondRow ? "👉 ابحث واختر مشرف المستشفى أو الإدارة بالاسم أو الهوية..." : "👉 ابحث واختر الموظف المعتمِد الآن..."}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-600 text-white font-bold text-xs">✓</span>
                            <div>
                              <p className="text-xs font-black text-slate-900 dark:text-slate-100">{step.approverLabel}</p>
                              <p className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">{step.approverPosition || (isSecondRow ? "مشرف معتمِد" : "معتمِد المستوى")}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => toggleEditing(step.id)} className="h-7 px-2.5 rounded-lg text-[11px] font-bold border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300">
                            تغيير الموظف ✏️
                          </Button>
                        </div>
                      )}
                    </td>

                    {/* Column 4: Actions (`عرض | تعديل | حذف`) */}
                    <td className="py-3.5 px-3.5 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setViewingStep(step)}
                          title="عرض تفاصيل المستوى"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-8 w-8 rounded-lg ${editing ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                          onClick={() => toggleEditing(step.id)}
                          title="تعديل هذا الفراغ / المستوى"
                        >
                          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />}
                        </Button>

                        {confirmingDelete ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 p-1 rounded-lg border border-rose-300 dark:border-rose-800">
                            <button onClick={() => removeStep(step.id)} className="px-1.5 py-0.5 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded text-[10px] font-black">حذف</button>
                            <button onClick={() => setConfirmingDeleteIds(new Set())} className="p-0.5 text-slate-500 hover:bg-slate-200 rounded"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/40"
                            onClick={() => setConfirmingDeleteIds((c) => new Set(c).add(step.id))}
                            title="حذف هذا المستوى"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Section: "إضافة حقل" Button right underneath the neat table exactly as requested */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            onClick={addStep}
            variant="outline"
            className="w-full sm:w-auto rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 hover:bg-primary/10 font-black text-xs h-10 px-5 gap-2 text-primary shadow-2xs"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>+ إضافة حقل / خانة مستوى موافقة جديد بعد هذا الجدول</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={`w-full sm:w-auto ${theme.saveBtn}`}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : null}
            <span>💾 حفظ إعدادات وتسلسل الطلبات في هذا الجدول</span>
          </Button>
        </div>
      </CardContent>

      {/* View Step Details Modal */}
      {viewingStep ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3.5 border border-slate-200 dark:border-slate-800" dir="rtl">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <span>تفاصيل الحقل ومستوى الاعتماد</span>
              </h3>
              <button onClick={() => setViewingStep(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2.5 text-xs font-semibold">
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border">
                <span className="text-muted-foreground">الفراغ الأول / حقل الجهة (المستشفى/الفرع):</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100">{viewingStep.orgUnitLabel || orgUnitLabelFor(viewingStep.orgUnitId, orgUnits) || "غير محدد"}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border">
                <span className="text-muted-foreground">الفراغ الثاني / الموظف المعتمِد (`اختيار أنا الموظف`):</span>
                <span className="font-extrabold text-primary">{viewingStep.approverLabel || "حقل فارغ (جاهز للاختيار)"}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border">
                <span className="text-muted-foreground">التوصيف والمرحلة:</span>
                <span className="font-bold">{viewingStep.approverPosition || "مستوى موافقة مخصص"}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button onClick={() => setViewingStep(null)} className="rounded-xl px-5 font-extrabold text-xs bg-primary text-white h-9">إغلاق</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
