"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { Loader2, Eye, Pencil, Trash2, CheckCircle2, AlertCircle, Plus, Layers, Building2, Check, X, ChevronDown } from "lucide-react";
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
  requestTypes?: string[];
  targetOrgUnitIds?: string[];
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
  initialRequestTypes?: string[];
  initialTargetOrgUnitIds?: string[];
  onSave?: (steps: WorkflowStepItem[], sendToDirectManagerFirst: boolean, workflowName: string, requestTypes: string[], targetOrgUnitIds: string[]) => Promise<void> | void;
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

// Multi-Select Dropdown Component with Teal/Mint Tags/Chips and individual 'x' remove button
function MultiSelectChips({
  label,
  placeholder,
  options,
  selectedValues,
  onChange
}: {
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  selectedValues: string[];
  onChange: (newValues: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter((v) => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const removeChip = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== idToRemove));
  };

  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(options.map((o) => o.id));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="space-y-2 relative font-sans" ref={containerRef} dir="rtl">
      <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
        {label}
      </label>

      {/* Main Display Box with Chips */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-12 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer flex items-center justify-between gap-2 shadow-2xs hover:border-primary/60 transition"
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {selectedValues.length === 0 ? (
            <span className="text-muted-foreground text-xs font-bold py-1">{placeholder}</span>
          ) : (
            selectedValues.map((val) => {
              const matched = options.find((o) => o.id === val);
              const displayLabel = matched ? matched.label : val;
              return (
                <span
                  key={val}
                  className="bg-primary/15 text-primary border border-primary/40 rounded-xl px-3 py-1 font-black text-xs flex items-center gap-1.5 transition hover:bg-primary/25 shadow-2xs"
                >
                  <span>{displayLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => removeChip(val, e)}
                    className="p-0.5 rounded-full hover:bg-primary/30 text-primary transition"
                    title="حذف فردي"
                  >
                    <X className="h-3 w-3 stroke-[3]" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedValues.length > 0 ? (
            <Badge variant="outline" className="bg-primary/10 text-primary font-mono font-black text-[10px] px-2 py-0.5">
              {selectedValues.length}
            </Badge>
          ) : null}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen ? (
        <div className="absolute z-50 w-full mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xl space-y-1 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
          {/* Action Toolbar inside dropdown: Select All / Clear All */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1 px-1">
            <span className="text-[11px] font-extrabold text-muted-foreground">اختر متعدد (Multi-Select):</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-black text-primary hover:underline"
              >
                تحديد الكل
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                إلغاء الكل
              </button>
            </div>
          </div>

          <div className="space-y-1 pr-1">
            {options.map((opt) => {
              const isSelected = selectedValues.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition ${
                    isSelected
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  <div className={`grid h-5 w-5 place-items-center rounded-md border text-xs font-black transition ${
                    isSelected ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-transparent"
                  }`}>
                    {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowManager({
  initialSteps = [],
  moduleName = "طلبات الإجازات",
  initialSendToDirectManagerFirst = true,
  initialRequestTypes = [],
  initialTargetOrgUnitIds = [],
  onSave,
  defaultOrgScopeType = "hospital"
}: WorkflowManagerProps) {
  const isHospital = defaultOrgScopeType === "hospital";
  const [workflowName, setWorkflowName] = useState<string>(moduleName);
  const [sendToDirectManagerFirst, setSendToDirectManagerFirst] = useState<boolean>(initialSendToDirectManagerFirst);
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [orgUnits, setOrgUnits] = useState<OrgUnits>(EMPTY_ORG_UNITS);
  const [requestTypes, setRequestTypes] = useState<DynamicRequestType[]>([]);
  
  // Multi-Select arrays state
  const [selectedRequestTypes, setSelectedRequestTypes] = useState<string[]>(initialRequestTypes.length > 0 ? initialRequestTypes : [moduleName || "طلبات الإجازات"]);
  const [selectedOrgUnitIds, setSelectedOrgUnitIds] = useState<string[]>(initialTargetOrgUnitIds);
  
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
    if (!selectedOrgUnitIds || selectedOrgUnitIds.length === 0) {
      if (orgId) setSelectedOrgUnitIds([orgId]);
    }

    // Initialize saved table with current loaded backend path
    const initialSavedRow: SavedWorkflowPath = {
      id: `path-init-${defaultOrgScopeType}`,
      workflowName: moduleName || "طلبات الإجازات",
      orgUnitId: orgId,
      orgUnitLabel: isHospital ? "جامعة الملك فيصل - الاحساء (أو المستشفيات المختارة)" : "جميع الإدارات والفروع المختارة",
      sendToDirectManagerFirst: initialSendToDirectManagerFirst,
      requestTypes: initialRequestTypes.length > 0 ? initialRequestTypes : [moduleName || "طلبات الإجازات"],
      targetOrgUnitIds: initialTargetOrgUnitIds.length > 0 ? initialTargetOrgUnitIds : [orgId],
      steps: activeSteps,
      createdAt: new Date().toLocaleDateString("ar-SA")
    };
    setSavedPaths([initialSavedRow]);
  }, [initialSteps, defaultOrgScopeType, moduleName, initialSendToDirectManagerFirst, isHospital, initialRequestTypes, initialTargetOrgUnitIds]);

  useEffect(() => {
    if (moduleName) setWorkflowName(moduleName);
  }, [moduleName]);

  // Dynamic Prisma Request Types & Org Units fetching
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
    const firstOrgId = selectedOrgUnitIds[0] || (isHospital ? "hospital:all" : "branch:all");
    const newStep = emptyStep(defaultOrgScopeType, firstOrgId);
    setSteps((current) => [...current, newStep]);
  };

  const removeApprover = (id: number | string) => {
    setSteps((current) => current.filter((s) => s.id !== id));
  };

  const updateApprover = (id: number | string, patch: Partial<WorkflowStepItem>) => {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  // Multi-Select Request Types change
  const handleMultiRequestTypesChange = (newValues: string[]) => {
    setSelectedRequestTypes(newValues);
    if (newValues.length > 0) {
      setWorkflowName(newValues.join(" + "));
    } else {
      setWorkflowName("مسار مخصص");
    }
  };

  // Multi-Select Org Units change: cascade to step orgUnitId
  const handleMultiOrgChange = (newValues: string[]) => {
    setSelectedOrgUnitIds(newValues);
    const primaryOrgId = newValues[0] || (isHospital ? "hospital:all" : "branch:all");
    const label = newValues.map((v) => orgUnitLabelFor(v, orgUnits) || v).join(" + ") || (isHospital ? "جميع المستشفيات" : "جميع الإدارات والفروع");
    setSteps((current) => current.map((s) => ({ ...s, orgUnitId: primaryOrgId, orgUnitLabel: label })));
  };

  function orgUnitLabelFor(orgUnitId: string, units: OrgUnits): string {
    if (!orgUnitId || !orgUnitId.includes(":")) return orgUnitId;
    const [type, id] = orgUnitId.split(":");
    const list = type === "department" ? units.departments : type === "branch" ? units.branches : type === "hospital" ? units.hospitals : [];
    return list.find((u) => u.id === id)?.name ?? orgUnitId;
  }

  // Build option lists for MultiSelectChips
  const requestTypeOptions = requestTypes.map((rt) => ({ id: rt.label, label: rt.label }));
  const orgUnitOptions = isHospital
    ? orgUnits.hospitals.map((h) => ({ id: `hospital:${h.id}`, label: h.name }))
    : [
        ...orgUnits.branches.map((b) => ({ id: `branch:${b.id}`, label: `فرع: ${b.name}` })),
        ...orgUnits.departments.map((d) => ({ id: `department:${d.id}`, label: `إدارة: ${d.name}` }))
      ];

  // Save handler: sends Array of selected request types and org units to Supabase/Prisma
  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        if (onSave) await onSave(steps, sendToDirectManagerFirst, workflowName, selectedRequestTypes, selectedOrgUnitIds);

        const currentOrgLabel = selectedOrgUnitIds.map((v) => orgUnitLabelFor(v, orgUnits) || v).join(" + ") || (isHospital ? "جامعة الملك فيصل - الاحساء" : "جميع الإدارات والفروع");

        if (editingPathId) {
          // Update existing row in table dynamically with fade animation
          setSavedPaths((prev) =>
            prev.map((p) =>
              p.id === editingPathId
                ? {
                    ...p,
                    workflowName: workflowName || selectedRequestTypes.join(" + ") || "طلبات الإجازات",
                    orgUnitId: selectedOrgUnitIds[0] || "",
                    orgUnitLabel: currentOrgLabel,
                    sendToDirectManagerFirst,
                    requestTypes: [...selectedRequestTypes],
                    targetOrgUnitIds: [...selectedOrgUnitIds],
                    steps: [...steps]
                  }
                : p
            )
          );
          setEditingPathId(null);
          setMessage("✓ تم تحديث مسار الطلب والمتعدد المعتمدين في الجدول بنجاح 100%");
        } else {
          // Add new row to table dynamically right below the form
          const newPathRecord: SavedWorkflowPath = {
            id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            workflowName: workflowName || selectedRequestTypes.join(" + ") || "طلبات الإجازات",
            orgUnitId: selectedOrgUnitIds[0] || "",
            orgUnitLabel: currentOrgLabel,
            sendToDirectManagerFirst,
            requestTypes: [...selectedRequestTypes],
            targetOrgUnitIds: [...selectedOrgUnitIds],
            steps: [...steps],
            createdAt: new Date().toLocaleDateString("ar-SA")
          };
          setSavedPaths((prev) => [newPathRecord, ...prev]);
          setMessage("✓ تم حفظ إعدادات المسار والمعتمدين وإرسال مصفوفة الاختيارات المتعددة لقاعدة البيانات بنجاح 100%");
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
      setSelectedRequestTypes(initialRequestTypes.length > 0 ? initialRequestTypes : [moduleName || "طلبات الإجازات"]);
      setSelectedOrgUnitIds(initialTargetOrgUnitIds);
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
    setSelectedOrgUnitIds(path.targetOrgUnitIds && path.targetOrgUnitIds.length > 0 ? path.targetOrgUnitIds : [path.orgUnitId]);
    setSelectedRequestTypes(path.requestTypes && path.requestTypes.length > 0 ? path.requestTypes : [path.workflowName]);
    setSendToDirectManagerFirst(path.sendToDirectManagerFirst);
    setSteps(path.steps && path.steps.length > 0 ? [...path.steps] : [emptyStep(defaultOrgScopeType, path.orgUnitId)]);
    setMessage(`✏️ جاري تعديل إعدادات مسار "${path.workflowName}" للمنشأة "${path.orgUnitLabel}" في النموذج العلوي...`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isLeaveSelected = selectedRequestTypes.some((r) => r.includes("إجازة") || r.includes("LEAVE")) || workflowName.includes("إجازة");

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
          1. القسم العلوي (نموذج الإضافة / التعديل): قائمة اختيار متعددة (Multi-Select Tags/Chips)
          ========================================================================================= */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b-2 border-primary/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {editingPathId ? `تعديل إعدادات مسار الطلبات (${workflowName})` : "إعدادات مسار الطلبات (إضافة مسار اختيار متعدد)"}
              </h2>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                القسم العلوي: قائمة اختيار متعددة للطلبات والفروع مع ظهور العناصر كـ (Tags/Chips) قابلة للحذف الفردي
              </p>
            </div>
          </div>
          {editingPathId ? (
            <Button size="sm" variant="outline" onClick={handleCancel} className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold">
              إلغاء وضع التعديل ✖
            </Button>
          ) : null}
        </div>

        {/* Card 1: اختيار متعدد للطلبات (MultiSelectChips) + اختيار متعدد للفروع/المستشفيات (MultiSelectChips) */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-5 transition-all duration-300">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* 1. قائمة اختيار متعددة للطلبات (Multi-Select Tags/Chips) */}
            <MultiSelectChips
              label="أنواع الطلبات (`اختيار متعدد Multi-Select`)"
              placeholder="اختر عدة أنواع طلبات في وقت واحد (مثلاً: الإجازات + السلف)..."
              options={requestTypeOptions}
              selectedValues={selectedRequestTypes}
              onChange={handleMultiRequestTypesChange}
            />

            {/* 2. قائمة اختيار متعددة للفروع/المستشفيات (Multi-Select Tags/Chips) */}
            <MultiSelectChips
              label={isHospital ? "المستشفيات (`اختيار متعدد Multi-Select`)" : "الإدارات والفروع (`اختيار متعدد Multi-Select`)"}
              placeholder={isHospital ? "اختر عدة مستشفيات لتطبيق الإعدادات دفعة واحدة..." : "اختر عدة إدارات أو فروع لتطبيق المسار عليها دفعة واحدة..."}
              options={orgUnitOptions}
              selectedValues={selectedOrgUnitIds}
              onChange={handleMultiOrgChange}
            />
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
            <span>{editingPathId ? "حفظ التعديلات وإرسال المصفوفة" : "حفظ (إرسال مصفوفة الاختيارات المتعددة)"}</span>
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
                عند الضغط على حفظ في الأعلى، تنعكس البيانات بمصفوفة الاختيارات المتعددة فوراً في هذا الجدول العَصري المنظم
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
            <p className="text-xs text-muted-foreground">قم باختيار أنواع الطلبات المتعددة والفروع والمستشفيات في النموذج العلوي واضغط على &apos;حفظ&apos; لإضافتها هنا</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg transition-all duration-300 animate-in fade-in">
            <table className="w-full text-right text-xs">
              <thead className="bg-primary/10 text-slate-900 dark:text-slate-100 font-black border-b border-primary/20">
                <tr>
                  <th className="py-4 px-4 font-black w-64">{isHospital ? "المستشفيات المختارة (Chips)" : "الإدارات / الفروع المختارة (Chips)"}</th>
                  <th className="py-4 px-4 font-black w-56">أنواع الطلبات المختارة (Chips)</th>
                  <th className="py-4 px-4 font-black w-32 text-center">توجيه للمدير أولاً</th>
                  <th className="py-4 px-4 font-black w-32 text-center">عدد المعتمدين</th>
                  <th className="py-4 px-4 font-black w-44 text-center">الإجراءات (عرض | تعديل | حذف)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {savedPaths.map((path) => {
                  const isBeingEdited = editingPathId === path.id;
                  const approversCount = path.steps?.filter((s) => s.roleContext !== "RESUMPTION_STAGE").length || 0;
                  
                  const targetOrgsList = path.targetOrgUnitIds && path.targetOrgUnitIds.length > 0 ? path.targetOrgUnitIds : [path.orgUnitId];
                  const requestTypesList = path.requestTypes && path.requestTypes.length > 0 ? path.requestTypes : [path.workflowName];

                  return (
                    <tr
                      key={path.id}
                      className={`transition-all duration-300 animate-in fade-in hover:bg-primary/5 ${
                        isBeingEdited ? "bg-primary/10 ring-1 ring-primary" : ""
                      }`}
                    >
                      {/* المستشفيات / الفروع المختارة as Tags/Chips */}
                      <td className="py-4 px-4 font-black text-slate-900 dark:text-slate-100">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {targetOrgsList.map((orgVal) => {
                            const label = orgUnitLabelFor(orgVal, orgUnits) || orgVal || (isHospital ? "جامعة الملك فيصل - الاحساء" : "جميع الفروع");
                            return (
                              <span key={orgVal} className="bg-primary/10 text-primary border border-primary/25 rounded-xl px-2.5 py-0.5 font-extrabold text-[11px] shadow-2xs">
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* أنواع الطلبات المختارة as Tags/Chips */}
                      <td className="py-4 px-4 font-bold text-primary text-sm">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {requestTypesList.map((rtVal) => (
                            <span key={rtVal} className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-0.5 font-black text-[11px] shadow-2xs">
                              {rtVal}
                            </span>
                          ))}
                        </div>
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
                <span>تفاصيل الاختيارات المتعددة والمعتمدين للمسار: ({viewingPath.workflowName})</span>
              </h3>
              <button onClick={() => setViewingPath(null)} className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3 text-xs font-semibold bg-primary/5 p-4 rounded-2xl border border-primary/20">
              <div>
                <span className="text-muted-foreground block mb-1">المنشآت / الفروع المختارة (`targetOrgUnitIds Array`):</span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(viewingPath.targetOrgUnitIds && viewingPath.targetOrgUnitIds.length > 0 ? viewingPath.targetOrgUnitIds : [viewingPath.orgUnitId]).map((orgVal) => {
                    const label = orgUnitLabelFor(orgVal, orgUnits) || orgVal || viewingPath.orgUnitLabel;
                    return <Badge key={orgVal} className="bg-primary text-white font-extrabold px-2.5 py-0.5">{label}</Badge>;
                  })}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block mb-1">أنواع الطلبات المختارة (`requestTypes Array`):</span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(viewingPath.requestTypes && viewingPath.requestTypes.length > 0 ? viewingPath.requestTypes : [viewingPath.workflowName]).map((rtVal) => (
                    <Badge key={rtVal} variant="outline" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-extrabold px-2.5 py-0.5 border-slate-300 dark:border-slate-700">{rtVal}</Badge>
                  ))}
                </div>
              </div>

              <div className="pt-1">
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
