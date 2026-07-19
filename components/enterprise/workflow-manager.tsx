"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Eye, Pencil, Trash2, CheckCircle2, AlertCircle, Plus, Layers, Building2, Landmark, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export type SavedWorkflowPath = {
  id: string;
  workflowName: string;
  orgUnitId: string;
  orgUnitLabel: string;
  sendToDirectManagerFirst: boolean;
  steps: WorkflowStepItem[];
  createdAt: string;
};

type OrgUnit = { id: string; name: string };
type OrgUnits = { departments: OrgUnit[]; branches: OrgUnit[]; hospitals: OrgUnit[] };
type DynamicRequestType = { id: string; code: string; label: string };

const EMPTY_ORG_UNITS: OrgUnits = { departments: [], branches: [], hospitals: [] };

interface WorkflowManagerProps {
  initialSteps?: WorkflowStepItem[];
  moduleName?: string;
  initialSendToDirectManagerFirst?: boolean;
  onSave?: (steps: WorkflowStepItem[], sendToDirectManagerFirst: boolean, workflowName: string) => Promise<void> | void;
  accent?: "teal" | "violet";
  defaultOrgScopeType?: "hospital" | "branch" | "department";
}

function emptyStep(defaultOrgType = "", orgId = ""): WorkflowStepItem {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    approverId: "",
    orgUnitId: orgId || (defaultOrgType ? `${defaultOrgType}:all` : ""),
    approverPosition: "الموظف المعتمد",
    orgUnitLabel: defaultOrgType === "hospital" ? "المستشفى" : "الإدارة / الفرع",
    roleContext: "APPROVER"
  };
}

export function WorkflowManager({
  initialSteps = [],
  moduleName = "طلبات الإجازات",
  initialSendToDirectManagerFirst = true,
  onSave,
  defaultOrgScopeType = "hospital"
}: WorkflowManagerProps) {
  const isHospital = defaultOrgScopeType === "hospital";
  const [workflowName, setWorkflowName] = useState<string>(moduleName);
  const [sendToDirectManagerFirst, setSendToDirectManagerFirst] = useState<boolean>(initialSendToDirectManagerFirst);
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [requestTypes, setRequestTypes] = useState<DynamicRequestType[]>([]);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Part 2: Saved paths table state
  const [savedPaths, setSavedPaths] = useState<SavedWorkflowPath[]>([]);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [viewingPath, setViewingPath] = useState<SavedWorkflowPath | null>(null);

  // Initialize steps and default saved path on mount
  useEffect(() => {
    const visibleSteps = (initialSteps || []).filter((s) => s.roleContext !== "RESUMPTION_STAGE");
    const activeSteps = visibleSteps.length > 0 ? visibleSteps : [emptyStep(defaultOrgScopeType)];
    setSteps(activeSteps);

    const firstWithOrg = activeSteps.find((s) => s.orgUnitId);
    const orgId = firstWithOrg ? firstWithOrg.orgUnitId : isHospital ? "hospital:all" : "branch:all";
    if (orgId) setSelectedOrgUnitId(orgId);

    // Initialize saved table with current loaded backend path so table has data immediately
    const initialSavedRow: SavedWorkflowPath = {
      id: `path-init-${defaultOrgScopeType}`,
      workflowName: moduleName || "طلبات الإجازات",
      orgUnitId: orgId,
      orgUnitLabel: isHospital ? "جميع المستشفيات (أو جامعة الملك فيصل)" : "جميع الإدارات والفروع",
      sendToDirectManagerFirst: initialSendToDirectManagerFirst,
      steps: activeSteps,
      createdAt: new Date().toLocaleDateString("ar-SA")
    };
    setSavedPaths([initialSavedRow]);
  }, [initialSteps, defaultOrgScopeType, moduleName, initialSendToDirectManagerFirst, isHospital]);

  useEffect(() => {
    if (moduleName) setWorkflowName(moduleName);
  }, [moduleName]);

  // Fetch dynamic request types and org units from Prisma database
  useEffect(() => {
    let cancelled = false;
    fetch("/api/enterprise/request-types", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.requestTypes)) {
          setRequestTypes(data.requestTypes);
        }
      })
      .catch(() => {});

    fetch("/api/enterprise/workflow-paths/org-units", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setOrgUnits({ departments: data.departments ?? [], branches: data.branches ?? [], hospitals: data.hospitals ?? [] });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const addApprover = () => {
    const newStep = emptyStep(defaultOrgScopeType, selectedOrgUnitId);
    setSteps((current) => [...current, newStep]);
  };

  const removeApprover = (id: number | string) => {
    setSteps((current) => current.filter((s) => s.id !== id));
  };

  const updateApprover = (id: number | string, patch: Partial<WorkflowStepItem>) => {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  // Cascading Selects handler: when Hospital or Branch/Department changes, cascade immediately to all approver steps
  const handleOrgUnitChange = (val: string) => {
    setSelectedOrgUnitId(val);
    const label = orgUnitLabelFor(val, orgUnits) || (isHospital ? "جميع المستشفيات" : "جميع الإدارات والفروع");
    setSteps((current) => current.map((s) => ({ ...s, orgUnitId: val, orgUnitLabel: label })));
  };

  const handleRequestTypeChange = (val: string) => {
    setWorkflowName(val);
  };

  function orgUnitLabelFor(orgUnitId: string, units: OrgUnits): string {
    if (!orgUnitId || !orgUnitId.includes(":")) return "";
    const [type, id] = orgUnitId.split(":");
    const list = type === "department" ? units.departments : type === "branch" ? units.branches : type === "hospital" ? units.hospitals : [];
    return list.find((u) => u.id === id)?.name ?? "";
  }

  // Save handler: saves to database and dynamically updates bottom table
  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        if (onSave) await onSave(steps, sendToDirectManagerFirst, workflowName);

        const currentOrgLabel = orgUnitLabelFor(selectedOrgUnitId, orgUnits) || (isHospital ? "جامعة الملك فيصل - الاحساء (أو جميع المستشفيات)" : "جميع الإدارات والفروع");

        if (editingPathId) {
          // Update existing row in table dynamically with fade animation
          setSavedPaths((prev) =>
            prev.map((p) =>
              p.id === editingPathId
                ? {
                    ...p,
                    workflowName: workflowName || "طلبات الإجازات",
                    orgUnitId: selectedOrgUnitId,
                    orgUnitLabel: currentOrgLabel,
                    sendToDirectManagerFirst,
                    steps: [...steps]
                  }
                : p
            )
          );
          setEditingPathId(null);
          setMessage("✓ تم تحديث مسار الطلب والمعتمدين في الجدول بنجاح 100%");
        } else {
          // Add new row to table dynamically right below the form
          const newPathRecord: SavedWorkflowPath = {
            id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            workflowName: workflowName || "طلبات الإجازات",
            orgUnitId: selectedOrgUnitId || (isHospital ? "hospital:all" : "branch:all"),
            orgUnitLabel: currentOrgLabel,
            sendToDirectManagerFirst,
            steps: [...steps],
            createdAt: new Date().toLocaleDateString("ar-SA")
          };
          setSavedPaths((prev) => [newPathRecord, ...prev]);
          setMessage("✓ تم حفظ إعدادات المسار والمعتمدين وتفعيل الترابط المنطقي للطلبات بنجاح 100%");
        }
      } catch (err: any) {
        setMessage(`⚠️ ${err.message || "حدث خطأ أثناء حفظ الإعدادات"}`);
      }
    });
  };

  const handleCancel = () => {
    if (editingPathId) {
      setEditingPathId(null);
      setMessage("ℹ️ تم إلغاء وضع التعديل واستعادة النموذج");
    } else {
      if (initialSteps && initialSteps.length > 0) {
        const visibleSteps = initialSteps.filter((s) => s.roleContext !== "RESUMPTION_STAGE");
        setSteps(visibleSteps.length > 0 ? visibleSteps : [emptyStep(defaultOrgScopeType)]);
      }
      setSendToDirectManagerFirst(initialSendToDirectManagerFirst);
      setWorkflowName(moduleName);
      setMessage("ℹ️ تم إلغاء التغييرات واستعادة الإعدادات الأصلية");
    }
  };

  // Section 2 Table Actions: Delete, Edit, View
  const handleDeletePath = (pathId: string) => {
    setSavedPaths((prev) => prev.filter((p) => p.id !== pathId));
    if (editingPathId === pathId) setEditingPathId(null);
    setMessage("✓ تم حذف مسار الطلب والمعتمدين من الجدول ديناميكياً بنجاح");
  };

  const handleEditPath = (path: SavedWorkflowPath) => {
    setEditingPathId(path.id);
    setWorkflowName(path.workflowName);
    setSelectedOrgUnitId(path.orgUnitId);
    setSendToDirectManagerFirst(path.sendToDirectManagerFirst);
    setSteps(path.steps && path.steps.length > 0 ? [...path.steps] : [emptyStep(defaultOrgScopeType, path.orgUnitId)]);
    setMessage(`✏️ جاري تعديل إعدادات مسار "${path.workflowName}" للمنشأة "${path.orgUnitLabel}" في النموذج العلوي...`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isLeaveSelected = workflowName.includes("إجازة") || workflowName.includes("LEAVE");

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 text-right font-sans p-2 transition-all duration-300 animate-in fade-in" dir="rtl">
      {message ? (
        <div className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
          message.startsWith("✓")
            ? "bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
            : message.startsWith("✏️") || message.startsWith("ℹ️")
            ? "bg-sky-50 text-sky-900 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
            : "bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2.5">
            {message.startsWith("✓") ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-sky-600 shrink-0" />}
            <span>{message}</span>
          </div>
          {editingPathId ? (
            <Badge variant="outline" className="bg-white/80 dark:bg-slate-900 text-sky-700 font-extrabold px-3 py-1">وضع التعديل المباشر</Badge>
          ) : null}
        </div>
      ) : null}

      {/* =========================================================================================
          1. القسم العلوي (نموذج الإضافة / التعديل): مطابق للصورة وللهوية الفيروزية لشركة لانا الطبية
          ========================================================================================= */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b-2 border-primary/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {editingPathId ? `تعديل إعدادات مسار الطلبات (${workflowName})` : "إعدادات مسار الطلبات (إضافة مسار جديد)"}
              </h2>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                القسم العلوي: نموذج الإضافة والترابط الديناميكي مع المعتمدين وتوجيه المدير المباشر
              </p>
            </div>
          </div>
          {editingPathId ? (
            <Button size="sm" variant="outline" onClick={handleCancel} className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold">
              إلغاء وضع التعديل ✖
            </Button>
          ) : null}
        </div>

        {/* Card 1: أنواع الطلبات (Select Dynamic from Prisma) + اختيار المستشفى/الإدارة (Cascading Selects) */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-5 transition-all duration-300">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* 1. قائمة أنواع الطلبات (Select Component تجلب أنواع الطلبات ديناميكياً بدون كل الأنواع) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                أنواع الطلبات (`الاسم - بالعربية`)
              </label>
              <select
                value={workflowName}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs transition"
              >
                <option value="">-- اختر نوع الطلب من قاعدة البيانات --</option>
                {requestTypes.map((rt) => (
                  <option key={rt.code} value={rt.label}>
                    {rt.label}
                  </option>
                ))}
                {workflowName && !requestTypes.some((rt) => rt.label === workflowName) ? (
                  <option value={workflowName}>{workflowName}</option>
                ) : null}
              </select>
            </div>

            {/* 2. المستشفى أو الإدارة والفروع (Cascading Select) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                {isHospital ? "المستشفى" : "الإدارة أو الفروع"}
              </label>
              <select
                value={selectedOrgUnitId}
                onChange={(e) => handleOrgUnitChange(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs transition"
              >
                <option value="">{isHospital ? "اختر المستشفى من القائمة (أو جميع المستشفيات)..." : "اختر الإدارة أو الفرع من القائمة..."}</option>
                {isHospital ? (
                  orgUnits.hospitals.map((h) => <option key={h.id} value={`hospital:${h.id}`}>{h.name}</option>)
                ) : (
                  <>
                    {orgUnits.branches.map((b) => <option key={b.id} value={`branch:${b.id}`}>فرع: {b.name}</option>)}
                    {orgUnits.departments.map((d) => <option key={d.id} value={`department:${d.id}`}>إدارة: {d.name}</option>)}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: توجيه الطلب للمدير المباشر أولا */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4 transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">توجيه الطلب للمدير المباشر أولا</h3>
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-950 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSendToDirectManagerFirst(true)}
                className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-black transition ${
                  sendToDirectManagerFirst
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
                }`}
              >
                <span>✓ نعم</span>
              </button>
              <button
                type="button"
                onClick={() => setSendToDirectManagerFirst(false)}
                className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-black transition ${
                  !sendToDirectManagerFirst
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
                }`}
              >
                <span>✖ لا</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2 bg-primary/5 p-3 rounded-xl border border-primary/20 text-slate-900 dark:text-slate-200">
              <span className="font-black shrink-0 text-primary mt-0.5">ℹ️ نعم:</span>
              <span>سيصل الطلب إلى مدير الموظف أولا، بعدها يبدأ تطبيق مرحلة سير الطلبات المحددة للمعتمدين</span>
            </div>
            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <span className="font-extrabold shrink-0 mt-0.5">ℹ️ لا:</span>
              <span>لن يصل الطلب إلى مدير الموظف، سيتم تطبيق مرحلة سير الطلبات المحددة للمعتمدين مباشرة</span>
            </div>
          </div>
        </div>

        {/* Card 3: المعتمدون (الموظف المعتمد + إضافة معتمد) */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">المعتمدون</h3>
            <button
              type="button"
              onClick={addApprover}
              className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/40 rounded-xl px-5 py-2 font-black text-xs transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>إضافة معتمد</span>
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-3.5">حدد المعتمدون (`الموظف المعتمد`)</label>
            <div className="space-y-3.5">
              {steps.map((step, index) => {
                const canRemove = steps.length > 1;
                return (
                  <div key={step.id} className="flex items-center gap-3 transition-all duration-300 animate-in fade-in">
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => removeApprover(step.id)}
                        className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-200 border border-rose-200 dark:border-rose-900 rounded-xl px-4 py-2.5 font-bold text-xs transition shrink-0 shadow-2xs"
                        title="إزالة"
                      >
                        إزالة
                      </button>
                    ) : null}

                    <div className="flex-1">
                      <UserSearchSelect
                        value={step.approverId}
                        initialLabel={step.approverLabel ?? ""}
                        onChange={(userId, label, employee) => {
                          updateApprover(step.id, {
                            approverId: userId,
                            approverLabel: label ?? "",
                            approverPosition: employee?.position?.title || step.approverPosition || "الموظف المعتمد"
                          });
                        }}
                        placeholder="اختر الموظف المعتمد بالاسم أو الرقم الوظيفي..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {isLeaveSelected ? (
              <div className="mt-5 p-4 bg-primary/10 rounded-2xl border border-primary/30 flex items-center justify-between gap-3 transition-all duration-300 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary text-white font-bold text-xs">✓</span>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">تطبيق منطق المباشرة بعد الإجازة (Hidden Resumption Step)</p>
                    <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">يتم تلقائياً إدراج مرحلة إضافية مدمجة باسم &apos;مباشرة بعد الإجازة&apos; ضمن تسلسل الاعتمادات لضمان تأكيد العودة للعمل.</p>
                  </div>
                </div>
                <Badge className="bg-primary text-white text-[10px] font-extrabold px-3 py-1 shrink-0">مرحلة مدمجة برمجياً</Badge>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action Buttons (حفظ | إلغاء) */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-slate-300/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-7 h-11 font-extrabold text-xs shadow-2xs"
          >
            {editingPathId ? "إلغاء وضع التعديل" : "إلغاء"}
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-primary text-white hover:bg-primary/90 rounded-xl px-9 h-11 font-black text-xs shadow-md shadow-primary/20 transition"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : null}
            <span>{editingPathId ? "حفظ التعديلات في الجدول" : "حفظ"}</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================================
          2. القسم السفلي (جدول البيانات - بعد الحفظ): يتحدّث ديناميكياً بضغطة زر وتلاشي سلس
          ========================================================================================= */}
      <div className="pt-10 border-t-2 border-dashed border-slate-200 dark:border-slate-800 space-y-5 transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                القسم السفلي: جدول مسارات الطلبات المحفوظة والمعرفة في النظام
              </h3>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                عند الضغط على حفظ في الأعلى، تنعكس البيانات فوراً في هذا الجدول العَصري المنظم مع أزرار الإجراءات الفورية
              </p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border border-primary/30 font-extrabold px-4 py-1.5 rounded-xl text-xs self-start sm:self-auto">
            {savedPaths.length} مسارات معرفة بالجدول
          </Badge>
        </div>

        {savedPaths.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
            <p className="text-sm font-black text-slate-700 dark:text-slate-300">لا توجد مسارات طلبات محفوظة في الجدول حالياً</p>
            <p className="text-xs text-muted-foreground">قم باختيار نوع الطلب والمستشفى/الفرع والموظفين المعتمدين في النموذج العلوي واضغط على &apos;حفظ&apos; لإضافتها هنا</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg transition-all duration-300 animate-in fade-in">
            <table className="w-full text-right text-xs">
              <thead className="bg-primary/10 text-slate-900 dark:text-slate-100 font-black border-b border-primary/20">
                <tr>
                  <th className="py-4 px-4 font-black w-60">{isHospital ? "المستشفى" : "الإدارة / الفرع"}</th>
                  <th className="py-4 px-4 font-black w-48">نوع الطلب (`الاسم - بالعربية`)</th>
                  <th className="py-4 px-4 font-black w-36 text-center">توجيه للمدير أولاً</th>
                  <th className="py-4 px-4 font-black w-36 text-center">عدد المعتمدين</th>
                  <th className="py-4 px-4 font-black w-44 text-center">الإجراءات (عرض | تعديل | حذف)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {savedPaths.map((path) => {
                  const isBeingEdited = editingPathId === path.id;
                  const approversCount = path.steps?.filter((s) => s.roleContext !== "RESUMPTION_STAGE").length || 0;
                  return (
                    <tr
                      key={path.id}
                      className={`transition-all duration-300 animate-in fade-in hover:bg-primary/5 ${
                        isBeingEdited ? "bg-primary/10 ring-1 ring-primary" : ""
                      }`}
                    >
                      {/* المستشفى / الإدارة */}
                      <td className="py-4 px-4 font-black text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">🏢</span>
                          <span>{path.orgUnitLabel || (isHospital ? "جامعة الملك فيصل - الاحساء (أو جميع المستشفيات)" : "جميع الإدارات والفروع")}</span>
                        </div>
                      </td>

                      {/* نوع الطلب */}
                      <td className="py-4 px-4 font-bold text-primary text-sm">
                        {path.workflowName}
                      </td>

                      {/* توجيه للمدير */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-black ${
                          path.sendToDirectManagerFirst
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {path.sendToDirectManagerFirst ? "✓ نعم (أولاً للمدير)" : "✖ لا (مباشرة للمعتمدين)"}
                        </span>
                      </td>

                      {/* عدد المعتمدين */}
                      <td className="py-4 px-4 text-center">
                        <Badge variant="secondary" className="bg-primary/10 text-primary font-extrabold text-xs px-3 py-1 rounded-xl">
                          {approversCount} معتمدين
                        </Badge>
                      </td>

                      {/* الإجراءات: عرض | تعديل | حذف */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-xl px-3 gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-primary/15 text-slate-700 dark:text-slate-300 hover:text-primary font-extrabold text-xs transition"
                            onClick={() => setViewingPath(path)}
                            title="عرض تفاصيل المعتمدين وسير العمل"
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span>عرض</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-8 rounded-xl px-3 gap-1 font-extrabold text-xs transition ${
                              isBeingEdited
                                ? "bg-primary text-white shadow-2xs"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-primary/15 text-slate-700 dark:text-slate-300 hover:text-primary"
                            }`}
                            onClick={() => handleEditPath(path)}
                            title="تعديل هذا المسار في النموذج العلوي"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>{isBeingEdited ? "يتم التعديل" : "تعديل"}</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-xl px-3 gap-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 font-extrabold text-xs transition"
                            onClick={() => handleDeletePath(path.id)}
                            title="حذف المعتمدين والمسار بضغطة زر ديناميكياً"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal for Details of Saved Path */}
      {viewingPath ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all duration-300 animate-in fade-in">
          <div className="max-w-xl w-full rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800 transition-all duration-300 animate-in fade-in slide-in-from-top-4" dir="rtl">
            <div className="flex items-center justify-between border-b pb-3.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <span>تفاصيل المعتمدين وسير العمل للمسار: ({viewingPath.workflowName})</span>
              </h3>
              <button onClick={() => setViewingPath(null)} className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-semibold bg-primary/5 p-4 rounded-2xl border border-primary/20">
              <div>
                <span className="text-muted-foreground block">المنشأة / النطاق:</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mt-0.5 block">{viewingPath.orgUnitLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">توجيه للمدير المباشر أولاً:</span>
                <span className="font-black text-primary text-sm mt-0.5 block">{viewingPath.sendToDirectManagerFirst ? "✓ نعم (يصل للمدير أولاً)" : "✖ لا (مباشرة للمعتمدين أدناه)"}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">تسلسل المعتمدين بالترتيب (`Workflow Approvers Chain`):</label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {viewingPath.steps?.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white font-bold text-xs">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{s.approverLabel || "موظف معتمِد مخصص"}</p>
                        <p className="text-[11px] font-extrabold text-primary mt-0.5">{s.approverPosition || "المعتمد في هذا المستوى"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-bold">المستوى رقم #{idx + 1}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setViewingPath(null)} className="rounded-xl px-7 font-extrabold text-xs bg-primary text-white h-10 shadow-sm">إغلاق وتأكيد</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
