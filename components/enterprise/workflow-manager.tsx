"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface WorkflowManagerProps {
  initialSteps?: WorkflowStepItem[];
  moduleName?: string;
  initialSendToDirectManagerFirst?: boolean;
  onSave?: (steps: WorkflowStepItem[], sendToDirectManagerFirst: boolean, workflowName: string) => Promise<void> | void;
  accent?: "teal" | "violet";
  defaultOrgScopeType?: "hospital" | "branch" | "department";
}

function emptyStep(defaultOrgType = ""): WorkflowStepItem {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    approverId: "",
    orgUnitId: defaultOrgType ? `${defaultOrgType}:all` : "",
    approverPosition: "معتمِد",
    orgUnitLabel: defaultOrgType === "hospital" ? "المستشفيات" : "الإدارة أو الفروع",
    roleContext: "APPROVER"
  };
}

export function WorkflowManager({
  initialSteps = [],
  moduleName = "إجازة سنوية",
  initialSendToDirectManagerFirst = true,
  onSave,
  defaultOrgScopeType = "hospital"
}: WorkflowManagerProps) {
  const isHospital = defaultOrgScopeType === "hospital";
  const [workflowName, setWorkflowName] = useState<string>(moduleName);
  const [sendToDirectManagerFirst, setSendToDirectManagerFirst] = useState<boolean>(initialSendToDirectManagerFirst);
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialSteps || initialSteps.length === 0) {
      setSteps([emptyStep(defaultOrgScopeType)]);
    } else {
      setSteps(initialSteps);
      const firstWithOrg = initialSteps.find((s) => s.orgUnitId);
      if (firstWithOrg && firstWithOrg.orgUnitId) {
        setSelectedOrgUnitId(firstWithOrg.orgUnitId);
      }
    }
  }, [initialSteps, defaultOrgScopeType]);

  useEffect(() => {
    if (moduleName) setWorkflowName(moduleName);
  }, [moduleName]);

  useEffect(() => {
    let cancelled = false;
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
    const newStep = emptyStep(defaultOrgScopeType);
    if (selectedOrgUnitId) newStep.orgUnitId = selectedOrgUnitId;
    setSteps((current) => [...current, newStep]);
  };

  const removeApprover = (id: number | string) => {
    setSteps((current) => current.filter((s) => s.id !== id));
  };

  const updateApprover = (id: number | string, patch: Partial<WorkflowStepItem>) => {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleOrgUnitChange = (val: string) => {
    setSelectedOrgUnitId(val);
    setSteps((current) => current.map((s) => ({ ...s, orgUnitId: val })));
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        if (onSave) await onSave(steps, sendToDirectManagerFirst, workflowName);
        setMessage("✓ تم حفظ إعدادات سير الطلبات والمعتمدين بنجاح");
      } catch (err: any) {
        setMessage(`⚠️ ${err.message || "حدث خطأ أثناء حفظ الإعدادات"}`);
      }
    });
  };

  const handleCancel = () => {
    if (initialSteps && initialSteps.length > 0) setSteps(initialSteps);
    setSendToDirectManagerFirst(initialSendToDirectManagerFirst);
    setWorkflowName(moduleName);
    setMessage("ℹ️ تم إلغاء التغييرات");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-right font-sans p-2" dir="rtl">
      {message ? (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.startsWith("✓")
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
            : message.startsWith("ℹ️")
            ? "bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300"
            : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
        }`}>
          <span>{message}</span>
        </div>
      ) : null}

      {/* Card 1: الاسم - بالعربية + اختيار المستشفى/الإدارة (بنفس شكل الصورة المرسلة تماماً وبدون الإنجليزي) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* الاسم - بالعربية */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">الاسم - بالعربية</label>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder={isHospital ? "إجازة سنوية - المستشفيات" : "إجازة سنوية - الإدارة والفروع"}
              className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition"
            />
          </div>

          {/* المستشفى أو الإدارة والفروع كما طلب المستخدم في الترتيب */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isHospital ? "المستشفى" : "الإدارة أو الفروع"}
            </label>
            <select
              value={selectedOrgUnitId}
              onChange={(e) => handleOrgUnitChange(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition"
            >
              <option value="">{isHospital ? "جميع المستشفيات (All Hospitals)" : "جميع الإدارات والفروع (All Branches)"}</option>
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

      {/* Card 2: توجيه الطلب للمدير المباشر أولا (مطابق تماماً للصورة المرجعية) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">توجيه الطلب للمدير المباشر أولا</h3>
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-950 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSendToDirectManagerFirst(true)}
              className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-black transition ${
                sendToDirectManagerFirst
                  ? "bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800"
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
                  ? "bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
              }`}
            >
              <span>✖ لا</span>
            </button>
          </div>
        </div>

        <div className="space-y-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-start gap-2 bg-sky-50/70 dark:bg-sky-950/30 p-3 rounded-xl border border-sky-100 dark:border-sky-900/50 text-sky-900 dark:text-sky-300">
            <span className="font-extrabold shrink-0 mt-0.5">ℹ️ نعم:</span>
            <span>سيصل الطلب إلى مدير الموظف أولا، بعدها يبدأ تطبيق مرحلة سير الطلبات المحددة</span>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <span className="font-extrabold shrink-0 mt-0.5">ℹ️ لا:</span>
            <span>لن يصل الطلب إلى مدير الموظف، سيتم تطبيق مرحلة سير الطلبات المحددة مباشرة</span>
          </div>
        </div>
      </div>

      {/* Card 3: المعتمدون (مطابق بالضبط للصورة المرجعية والمطلوبة دون أي إضافات خارجية) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">المعتمدون</h3>
          <button
            type="button"
            onClick={addApprover}
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300/60 dark:border-emerald-800 rounded-xl px-5 py-2 font-extrabold text-xs transition flex items-center gap-1.5 shadow-2xs"
          >
            <span>إضافة معتمد</span>
          </button>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-3.5">حدد المعتمدون</label>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const canRemove = steps.length > 1;
              return (
                <div key={step.id} className="flex items-center gap-3">
                  {/* إزالة button exactly as shown in Screenshot ... 123046.png */}
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

                  {/* Approver Selection Field (UserSearchSelect exactly matching image) */}
                  <div className="flex-1">
                    <UserSearchSelect
                      value={step.approverId}
                      initialLabel={step.approverLabel ?? ""}
                      onChange={(userId, label, employee) => {
                        updateApprover(step.id, {
                          approverId: userId,
                          approverLabel: label ?? "",
                          approverPosition: employee?.position?.title || step.approverPosition || ""
                        });
                      }}
                      placeholder="اختر المعتمد بالاسم أو الرقم الوظيفي..."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons (حفظ | إلغاء) exactly matching bottom corner of reference image */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          onClick={handleCancel}
          variant="outline"
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-slate-300/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-7 h-10 font-extrabold text-xs shadow-2xs"
        >
          إلغاء
        </Button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-sky-50 text-sky-800 border border-sky-300 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800 rounded-xl px-8 h-10 font-black text-xs shadow-sm transition"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : null}
          <span>حفظ</span>
        </Button>
      </div>
    </div>
  );
}
