"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Check, X, CheckCircle2, Shield, Loader2, GitPullRequest, Eye, Trash2, HelpCircle, ArrowDown, Building2, Landmark, UserCheck, Layers, FileText } from "lucide-react";
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

const REQUEST_TYPE_OPTIONS = [
  { id: "ALL", label: "جميع الطلبات (All Requests - شامل)", icon: Layers, description: "يغطي كافة أنواع الطلبات في النظام دون استثناء" },
  { id: "LEAVE", label: "طلب إجازة (Leave Request)", icon: FileText, description: "الإجازات السنوية والمرضية والاضطرارية" },
  { id: "RESUMPTION", label: "طلب المباشرة بعد الإجازة (Resumption)", icon: UserCheck, description: "تأكيد مباشرة العمل والعودة من الإجازة" },
  { id: "OVERTIME", label: "العمل الإضافي (Overtime)", icon: FileText, description: "ساعات التكليف والعمل الإضافي" },
  { id: "LOAN", label: "السلف والقروض (Loans)", icon: FileText, description: "السلف المالية وسداد الأقساط" },
  { id: "EXPENSE", label: "المصاريف والعُهد (Expenses & Assets)", icon: FileText, description: "استعاضة المصاريف وتسليم العُهد" }
];

const ACCENTS = {
  teal: {
    headerBg: "bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white",
    icon: "bg-teal-500/20 text-teal-300 border border-teal-400/30",
    badge: "bg-teal-500/20 text-teal-200 border-teal-400/30",
    cardBorder: "border-teal-200/80 dark:border-teal-800/80 hover:border-teal-400 dark:hover:border-teal-600",
    stepBg: "bg-teal-50/40 dark:bg-teal-950/20",
    stepHeader: "bg-teal-100/70 dark:bg-teal-950/60 text-teal-950 dark:text-teal-200 border-b border-teal-200/60 dark:border-teal-900/80",
    arrow: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800",
    number: "bg-teal-600 text-white font-black",
    saveBtn: "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black shadow-lg shadow-teal-600/25 h-12 px-8 rounded-2xl text-base"
  },
  violet: {
    headerBg: "bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white",
    icon: "bg-violet-500/20 text-violet-300 border border-violet-400/30",
    badge: "bg-violet-500/20 text-violet-200 border-violet-400/30",
    cardBorder: "border-violet-200/80 dark:border-violet-800/80 hover:border-violet-400 dark:hover:border-violet-600",
    stepBg: "bg-violet-50/40 dark:bg-violet-950/20",
    stepHeader: "bg-violet-100/70 dark:bg-violet-950/60 text-violet-950 dark:text-violet-200 border-b border-violet-200/60 dark:border-violet-900/80",
    arrow: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800",
    number: "bg-violet-600 text-white font-black",
    saveBtn: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black shadow-lg shadow-violet-600/25 h-12 px-8 rounded-2xl text-base"
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

function getSketchStageDetails(index: number, isHospital: boolean, roleContext = "", approverPos = "") {
  if (isHospital) {
    if (index === 0 || roleContext === "HOSPITAL_INITIATOR") {
      return { title: "المستشفى (Hospital Initiator)", note: "← جميع المستشفيات / بدء وتقديم الطلب من المنشأة الطبية" };
    }
    if (index === 1 || roleContext === "HOSPITAL_SUPERVISOR") {
      return { title: "مشرف المستشفى (Supervisor)", note: "← اختيار أنا الموظف | إضافة حقل أو خانة في حسابه عند إضافة في تسلسل الطلبات" };
    }
    if (index === 2 || roleContext === "DEPARTMENT_MANAGER") {
      return { title: "مدير المستشفى / الإدارة (Manager Review)", note: "← اختيار أنا الموظف | إظهار جميع موظفين واعتماد أو رفض الطلب" };
    }
    if (index === 3 || roleContext === "HR_MANAGER") {
      return { title: "إدارة الموارد البشرية (HR)", note: "← اختيار أنا الموظف | الموافقة على الطلبات أو الرفض والتدقيق الشامل" };
    }
    if (index === 4 || roleContext === "PAYROLL_OFFICER") {
      return { title: "مسؤول الرواتب والمستحقات (Payroll Officer)", note: "← اختيار أنا الموظف | معالجة الآثار المالية ومسيّر المستحقات" };
    }
    if (index === 5 || roleContext === "FINAL_ONBOARDING") {
      return { title: "إضافة موظف / الخطوة النهائية (Final Onboarding)", note: "← اختيار أنا الموظف | إضافة حقل وتعبئة البيانات المحددة لتسكين الموظف وإتمام الطلب" };
    }
  } else {
    if (index === 0 || roleContext === "BRANCH_INITIATOR") {
      return { title: "الإدارة أو الفرع (Administration / Branch)", note: "← بدء ورفع الطلب من الإدارة المعنية أو الفرع التشغيلي" };
    }
    if (index === 1 || roleContext === "BRANCH_MANAGER") {
      return { title: "المدير (Manager Review Stage)", note: "← اختيار أنا الموظف | مراجعة واعتماد أو إرجاع الطلب للموظف" };
    }
    if (index === 2 || roleContext === "HR_MANAGER") {
      return { title: "إدارة الموارد البشرية (HR)", note: "← اختيار أنا الموظف | الموافقة على الطلبات أو الرفض والتدقيق النظامي" };
    }
    if (index === 3 || roleContext === "EMPLOYEE_FINAL_STEP") {
      return { title: "موظف مختص / الخطوة النهائية (Employee Final Entry)", note: "← اختيار أنا الموظف | إضافة حقل وتعبئة البيانات المحددة لإتمام الطلب" };
    }
  }
  return { title: approverPos || `المستوى رقم ${index + 1}`, note: "← اختيار أنا الموظف | مرحلة اعتماد مخصصة في تسلسل الطلب" };
}

export function WorkflowManager({ initialSteps = [], moduleName = "المسار المعتمد", onSave, accent = "teal", defaultOrgScopeType }: WorkflowManagerProps) {
  const theme = ACCENTS[accent] ?? ACCENTS.teal;
  const isHospital = defaultOrgScopeType === "hospital";
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [editingIds, setEditingIds] = useState<Set<number | string>>(new Set());
  const [editingOrgIds, setEditingOrgIds] = useState<Set<number | string>>(new Set());
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

  const toggleEditingOrg = (id: number | string) => {
    setEditingOrgIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRequestType = (typeId: string) => {
    if (typeId === "ALL") {
      if (selectedRequestTypes.includes("ALL")) {
        setSelectedRequestTypes([]);
      } else {
        setSelectedRequestTypes(["ALL", "LEAVE", "RESUMPTION", "OVERTIME", "LOAN", "EXPENSE"]);
      }
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
        setMessage("✓ تم حفظ إعدادات وتسلسل الطلبات لهذا المسار بنجاح 100% (وفق الترتيب والربط الاحترافي الذي اخترته)");
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
          <div className={`grid h-14 w-14 place-items-center rounded-2xl ${theme.icon} shadow-inner shrink-0`}>
            {isHospital ? <Building2 className="h-7 w-7" /> : <Landmark className="h-7 w-7" />}
          </div>
          <div>
            <h2 className="text-2xl font-black">{moduleName}</h2>
            <p className="text-xs text-white/80 font-semibold mt-1">
              تسلسل الطلبات وفق اختيارك الحر المباشر — حدد بالضبط لمن تمر الطلبات وقم بإضافة الحقول أو المستويات بمرونة مطلقة
            </p>
          </div>
        </div>
        <Badge className={`px-4 py-2 rounded-xl font-mono font-bold text-sm shadow-sm ${theme.badge}`}>
          {steps.length} مستويات في هذا التسلسل
        </Badge>
      </div>

      <CardContent className="p-6 space-y-8">
        {/* Section 1: نوع الطلب المرتبط بهذا المسار (Request Type Selector as in user sketch) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40 space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">نوع الطلب المغطى بهذا المسار (`Request Types`)</h3>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 font-extrabold text-xs">
              ✓ تم إضافة جميع الطلبات كي يتم التسلسل لها تلقائياً
            </Badge>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            اختر أنواع الطلبات التي تخضع لهذا المسار والترتيب؛ عند اختيارك لموظف في أي مرحلة أدناه، ستمر إليه هذه الطلبات مباشرةً بالترتيب المحدد:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {REQUEST_TYPE_OPTIONS.map((opt) => {
              const active = selectedRequestTypes.includes(opt.id);
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleRequestType(opt.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border shadow-2xs ${
                    active
                      ? "bg-primary text-white border-primary shadow-primary/20 scale-[1.02]"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-primary/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-white" : "text-primary"}`} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {message ? (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            message.startsWith("✓") 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            <span>{message}</span>
          </div>
        ) : null}

        {/* Section 2: Vertical Flow Step Cards (Exactly replicating the hand-drawn boxes with "اختيار أنا الموظف") */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>خطوات وتسلسل الاعتماد</span>
              <Badge variant="secondary" className="text-xs font-bold">حسب رسم ومخطط التعديل الاحترافي</Badge>
            </h3>
            <span className="text-xs font-bold text-muted-foreground">لكل مرحلة: اختر الموظف، واستخدم أزرار [ عرض | تعديل | حذف ]</span>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => {
              const editing = editingIds.has(step.id);
              const editingOrg = editingOrgIds.has(step.id);
              const confirmingDelete = confirmingDeleteIds.has(step.id);
              const sketchInfo = getSketchStageDetails(index, isHospital, step.roleContext, step.approverPosition);
              const isAssigned = Boolean(step.approverId);

              return (
                <div key={step.id} className="flex flex-col items-center">
                  {/* The Stage Card (Exact Box from user drawing) */}
                  <Card className={`w-full rounded-3xl border-2 transition-all shadow-md ${theme.cardBorder} ${editing ? "ring-2 ring-primary" : ""}`}>
                    {/* Stage Header Bar */}
                    <div className={`px-5 py-3.5 rounded-t-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${theme.stepHeader}`}>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm shadow-sm ${theme.number}`}>
                          {index + 1}
                        </span>
                        <div>
                          <h4 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{sketchInfo.title}</span>
                          </h4>
                          <p className="text-xs font-extrabold text-primary dark:text-primary/90 mt-0.5">
                            {sketchInfo.note}
                          </p>
                        </div>
                      </div>

                      {/* Org Unit Selection / Scope */}
                      <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                          {step.orgUnitLabel || orgUnitLabelFor(step.orgUnitId, orgUnits) || (isHospital ? "جميع المستشفيات" : "الإدارة / الفرع التشغيلي")}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={() => toggleEditingOrg(step.id)}
                          title="تغيير الجهة أو النطاق التشغيلي لهذا المستوى"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Stage Body: "اختيار أنا الموظف" Box */}
                    <CardContent className={`p-5 space-y-4 ${theme.stepBg}`}>
                      {editingOrg ? (
                        <div className="p-3 bg-white dark:bg-slate-950 rounded-2xl border border-primary/30 space-y-2">
                          <label className="text-xs font-extrabold text-primary">تغيير الجهة / النطاق التشغيلي للمستوى رقم {index + 1}:</label>
                          <select
                            value={step.orgUnitId}
                            onChange={(e) => {
                              updateStep(step.id, { orgUnitId: e.target.value, orgUnitLabel: orgUnitLabelFor(e.target.value, orgUnits) });
                              toggleEditingOrg(step.id);
                            }}
                            className="h-10 w-full rounded-xl border border-input bg-white dark:bg-slate-900 px-3 text-xs font-bold shadow-2xs focus:ring-2 focus:ring-primary"
                          >
                            <option value="">اختر الجهة أو النطاق...</option>
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
                        </div>
                      ) : null}

                      {/* "اختيار أنا الموظف" Search / Display Area */}
                      <div className="rounded-2xl bg-white dark:bg-slate-950 p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                              <UserCheck className="h-4 w-4" />
                            </span>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                              ← اختيار أنا الموظف (`اختر الموظف المعتمِد لهذا المستوى بالاسم أو الهوية`)
                            </span>
                          </div>
                          {!editing && isAssigned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleEditing(step.id)}
                              className="h-8 px-3 rounded-xl text-xs font-extrabold gap-1.5 border-primary/30 hover:bg-primary/5 text-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>تغيير الموظف (`اختيار أنا الموظف`)</span>
                            </Button>
                          ) : null}
                        </div>

                        {editing || !isAssigned ? (
                          <div className="space-y-3 pt-1">
                            <UserSearchSelect
                              value={step.approverId}
                              initialLabel={step.approverLabel ?? ""}
                              onChange={(userId, label, employee) => {
                                updateStep(step.id, {
                                  approverId: userId,
                                  approverLabel: label ?? "",
                                  approverPosition: employee?.position?.title || step.approverPosition || ""
                                });
                                if (userId && editing) toggleEditing(step.id);
                              }}
                              placeholder="👉 ابحث بالاسم أو الإقامة أو الرقم الوظيفي لاختيار الموظف المعتمِد الآن..."
                            />
                            {step.approverId ? (
                              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">✓ تم اختيار الموظف: {step.approverLabel}</span>
                                <Button size="sm" onClick={() => toggleEditing(step.id)} className="h-7 px-3 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700">تأكيد الاختيار</Button>
                              </div>
                            ) : (
                              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-800 flex items-center gap-1.5">
                                <span>💡 حقل الموظف فارغ ونظيف — أنت حر في تحديد لمن تمر الطلبات في هذا المستوى بمرونة مطلقة.</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold shadow-2xs">
                                ✓
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                  {step.approverLabel}
                                </p>
                                <p className="text-xs font-extrabold text-muted-foreground mt-0.5">
                                  المتطلب والوظيفة: {step.approverPosition || sketchInfo.title}
                                </p>
                              </div>
                            </div>
                            <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg text-xs self-start sm:self-center">
                              ✓ اختيار الموظف معتمد
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Stage Footer Action Toolbar: exactly the 3 buttons drawn at bottom of sketch box: [ عرض | تعديل | حذف ] */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground">أزرار التحكم بالمستوى:</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-xl text-xs font-extrabold px-3.5 gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 shadow-2xs"
                            onClick={() => setViewingStep(step)}
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span>عرض</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 rounded-xl text-xs font-extrabold px-3.5 gap-1.5 shadow-2xs ${editing ? "bg-primary text-white border-primary" : "bg-white dark:bg-slate-900 hover:bg-slate-100"}`}
                            onClick={() => toggleEditing(step.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>تعديل</span>
                          </Button>

                          {confirmingDelete ? (
                            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 p-1 rounded-xl border border-rose-300 dark:border-rose-800">
                              <button onClick={() => removeStep(step.id)} className="px-2 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-lg text-xs font-black">تأكيد الحذف 🗑️</button>
                              <button onClick={() => setConfirmingDeleteIds(new Set())} className="p-1 text-slate-500 hover:bg-slate-200 rounded-lg"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl text-xs font-extrabold px-3.5 gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 shadow-2xs"
                              onClick={() => setConfirmingDeleteIds((c) => new Set(c).add(step.id))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>حذف</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Vertical Flow Connector Arrow (unless last item, or before "+ إضافة حقل") */}
                  <div className="my-3 grid h-10 w-10 place-items-center rounded-2xl shadow-xs transition-transform hover:scale-110">
                    <div className={`grid h-8 w-8 place-items-center rounded-xl font-bold ${theme.arrow}`}>
                      <ArrowDown className="h-4 w-4 stroke-[3]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: "+ إضافة حقل" Box right below the vertical steps flow (Exactly matching drawing) */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={addStep}
            variant="outline"
            className="w-full rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 font-black text-sm h-14 px-6 gap-2 text-primary shadow-sm transition-all"
          >
            <Plus className="h-5 w-5 stroke-[3]" />
            <span>| + إضافة حقل | (`إضافة مستوى موافقة جديد بعد المستوى الأخير`)</span>
          </Button>
        </div>

        {/* Section 4: Final Save Bar ("| حفظ |" Box from drawing) */}
        <div className="pt-6 border-t-2 border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={`w-full sm:w-auto min-w-[320px] ${theme.saveBtn}`}
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin me-2" /> : null}
            <span>| 💾 حفظ إعدادات وتسلسل الطلبات لهذا المسار |</span>
          </Button>
          <p className="text-xs font-bold text-muted-foreground mt-2.5 text-center">
            ✓ عند الضغط على حفظ، يتم اعتماد هذا الترتيب فوراً على البيئة الحية وتتجه الطلبات للموظفين الذين اخترتهم بالحرية التامة.
          </p>
        </div>
      </CardContent>

      {/* View Step Details Modal */}
      {viewingStep ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800" dir="rtl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <span>تفاصيل مستوى ومرحلة الاعتماد</span>
              </h3>
              <button onClick={() => setViewingStep(null)} className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-xs font-semibold">
              <div className="flex justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border">
                <span className="text-muted-foreground">الجهة / النطاق التشغيلي:</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100">{viewingStep.orgUnitLabel || orgUnitLabelFor(viewingStep.orgUnitId, orgUnits) || (isHospital ? "جميع المستشفيات" : "الإدارة أو الفرع")}</span>
              </div>
              <div className="flex justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border">
                <span className="text-muted-foreground">الموظف المعتمِد (`اختيار أنا الموظف`):</span>
                <span className="font-extrabold text-primary text-sm">{viewingStep.approverLabel || "حقل فارغ (جاهز للاختيار الحر)"}</span>
              </div>
              <div className="flex justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border">
                <span className="text-muted-foreground">المرحلة / الدور في المخطط:</span>
                <span className="font-bold">{viewingStep.approverPosition || "مستوى موافقة مخصص"}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button onClick={() => setViewingStep(null)} className="rounded-xl px-6 font-extrabold text-xs bg-primary text-white">إغلاق وتأكيد</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
