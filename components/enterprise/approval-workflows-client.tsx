"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Copy, Pencil, X, Check, ArrowUp, ArrowDown, ChevronDown, GripVertical, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

const ENTITY_TYPE_LABELS: Record<string, string> = { HOSPITAL: "مستشفى", DEPARTMENT: "إدارة", BRANCH: "فرع", PROJECT: "مشروع" };
const ENTITY_TYPES = ["HOSPITAL", "DEPARTMENT", "BRANCH", "PROJECT"] as const;

type OrgEntities = {
  companies: { id: string; name: string; code: string }[];
  hospitals: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  projects: { id: string; name: string }[];
};

type Stage = { order: number; name: string; approverEmployeeId: string; approverLabel: string; isMandatory: boolean };
type PathRow = {
  id: string; companyId: string; companyName: string; entityType: string; entityId: string; entityName: string;
  requestType: string; name: string | null; isActive: boolean; stages: Stage[];
};

const emptyOrg: OrgEntities = { companies: [], hospitals: [], departments: [], branches: [], projects: [] };

function entityOptions(org: OrgEntities, entityType: string) {
  if (entityType === "HOSPITAL") return org.hospitals;
  if (entityType === "DEPARTMENT") return org.departments;
  if (entityType === "BRANCH") return org.branches;
  if (entityType === "PROJECT") return org.projects;
  return [];
}

function MultiSelectChipsDropdown({
  label,
  placeholder,
  options,
  selectedIds,
  onChange,
  showCustomOption = false,
  customValue = ""
}: {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  showCustomOption?: boolean;
  customValue?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLLabelElement>(null);

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
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((v) => v !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeChip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((v) => v !== id));
  };

  return (
    <label className="space-y-1.5 text-sm block relative font-sans" ref={containerRef} dir="rtl">
      <span className="font-bold flex items-center justify-between">
        <span>{label}</span>
        <Badge variant="outline" className="bg-primary/10 text-primary font-mono text-[10px] px-2 py-0">
          {selectedIds.length} محدد
        </Badge>
      </span>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-10 w-full rounded-lg border bg-background px-3 py-1 text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 shadow-2xs hover:border-primary/60 transition"
      >
        <div className="flex flex-wrap items-center gap-1 flex-1">
          {selectedIds.length === 0 ? (
            <span className="text-muted-foreground text-xs font-medium py-1">{placeholder}</span>
          ) : (
            selectedIds.map((val) => {
              const matched = options.find((o) => o.id === val);
              const displayLabel = matched ? matched.name : (val === "OTHER" && customValue ? customValue : val);
              return (
                <span
                  key={val}
                  className="bg-primary/15 text-primary border border-primary/40 rounded-xl px-2.5 py-0.5 font-black text-xs flex items-center gap-1 transition hover:bg-primary/25 shadow-2xs"
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
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl space-y-1 transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1 px-1">
            <span className="text-[11px] font-extrabold text-muted-foreground">اختيار متعدد (`Multi-Select`):</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(options.map((o) => o.id)); }}
                className="text-[11px] font-black text-primary hover:underline"
              >
                تحديد الكل
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                إلغاء الكل
              </button>
            </div>
          </div>

          <div className="space-y-1 pr-1">
            {options.map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
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
                  <span className="truncate">{opt.name}</span>
                  <div className={`grid h-5 w-5 place-items-center rounded-md border text-xs font-black transition ${
                    isSelected ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-transparent"
                  }`}>
                    {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                  </div>
                </div>
              );
            })}

            {showCustomOption && (
              <div
                onClick={() => toggleOption("OTHER")}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition ${
                  selectedIds.includes("OTHER")
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <span className="truncate">نوع آخر (مخصص)...</span>
                <div className={`grid h-5 w-5 place-items-center rounded-md border text-xs font-black transition ${
                  selectedIds.includes("OTHER") ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-transparent"
                }`}>
                  {selectedIds.includes("OTHER") ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </label>
  );
}

export function ApprovalWorkflowsClient() {
  const [org, setOrg] = useState<OrgEntities>(emptyOrg);
  const [requestTypeOptions, setRequestTypeOptions] = useState<{ id: string; label: string }[]>([]);
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterEntityId, setFilterEntityId] = useState("");
  const [filterRequestType, setFilterRequestType] = useState("");
  const [search, setSearch] = useState("");

  // Editor state (null = closed, "new" = creating, else editing that id)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [entityType, setEntityType] = useState<string>("HOSPITAL");
  const [entityId, setEntityId] = useState("");
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [requestType, setRequestType] = useState("");
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [customRequestType, setCustomRequestType] = useState("");
  const [pathName, setPathName] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const loadOrg = () => fetch("/api/enterprise/org-entities").then((r) => r.json()).then((d) => { if (d.success) setOrg(d); });
  const loadRequestTypes = () => fetch("/api/enterprise/request-types").then((r) => r.json()).then((d) => { if (d.success) setRequestTypeOptions(d.requestTypes ?? []); });
  const loadPaths = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompanyId) params.set("companyId", filterCompanyId);
    if (filterEntityType) params.set("entityType", filterEntityType);
    if (filterEntityId) params.set("entityId", filterEntityId);
    if (filterRequestType) params.set("requestType", filterRequestType);
    if (search) params.set("search", search);
    fetch(`/api/enterprise/approval-paths?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setPaths(d.paths); else setMessage(d.message || "فشل تحميل مسارات الموافقات"); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrg(); loadRequestTypes(); }, []);
  useEffect(loadPaths, [filterCompanyId, filterEntityType, filterEntityId, filterRequestType, search]);

  function openCreate() {
    setEditingId(null);
    setCompanyId(org.companies[0]?.id ?? "");
    setEntityType("HOSPITAL");
    setEntityId("");
    setEntityIds([]);
    setRequestType("");
    setRequestTypes([]);
    setCustomRequestType("");
    setPathName("");
    setStages([]);
    setEditorOpen(true);
  }

  function openEdit(path: PathRow) {
    setEditingId(path.id);
    setCompanyId(path.companyId);
    setEntityType(path.entityType);
    setEntityId(path.entityId);
    setEntityIds([path.entityId]);
    setRequestType(requestTypeOptions.some((t) => t.id === path.requestType) ? path.requestType : "OTHER");
    setRequestTypes([path.requestType]);
    setCustomRequestType(requestTypeOptions.some((t) => t.id === path.requestType) ? "" : path.requestType);
    setPathName(path.name ?? "");
    setStages(path.stages.map((s) => ({ ...s })));
    setEditorOpen(true);
  }

  function openDuplicate(path: PathRow) {
    openEdit(path);
    setEditingId(null);
    setPathName(path.name ? `${path.name} (نسخة)` : "");
  }

  function addStage() {
    setStages((current) => [...current, { order: current.length + 1, name: "", approverEmployeeId: "", approverLabel: "", isMandatory: true }]);
  }
  function removeStage(index: number) {
    setStages((current) => current.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
  }
  function moveStage(index: number, direction: -1 | 1) {
    setStages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }
  function updateStage(index: number, patch: Partial<Stage>) {
    setStages((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  const targetEntityIds = entityIds.length > 0 ? entityIds : (entityId ? [entityId] : []);
  const targetRequestTypes = requestTypes.length > 0
    ? requestTypes.map((t) => (t === "OTHER" ? customRequestType.trim().toUpperCase() : t)).filter(Boolean)
    : (requestType ? [requestType] : []);

  async function savePath() {
    if (!companyId || !targetEntityIds.length || !targetRequestTypes.length || !stages.length) {
      setMessage("الشركة، الجهة (أو أكثر)، نوع الطلب (أو أكثر)، ومرحلة واحدة على الأقل كلها مطلوبة");
      return;
    }
    if (stages.some((s) => !s.approverEmployeeId)) {
      setMessage("كل مرحلة تحتاج موظفاً مسؤولاً عن الموافقة");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId, entityType, entityId: targetEntityIds[0] || "", entityIds: targetEntityIds, requestType: targetRequestTypes[0] || "", requestTypes: targetRequestTypes, name: pathName || undefined,
        stages: stages.map((s) => ({ name: s.name || undefined, approverEmployeeId: s.approverEmployeeId, isMandatory: s.isMandatory }))
      };
      const response = editingId && targetEntityIds.length <= 1 && targetRequestTypes.length <= 1
        ? await fetch(`/api/enterprise/approval-paths/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/enterprise/approval-paths", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل حفظ مسار الموافقة"); return; }
      setMessage("تم حفظ مسار الموافقة بنجاح");
      setEditorOpen(false);
      loadPaths();
    } finally {
      setSaving(false);
    }
  }

  async function deletePath(id: string) {
    const response = await fetch(`/api/enterprise/approval-paths/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.success) { setMessage(data.message || "فشل حذف مسار الموافقة"); return; }
    setConfirmingDeleteId(null);
    loadPaths();
  }

  const entityFilterOptions = useMemo(() => entityOptions(org, filterEntityType), [org, filterEntityType]);
  const entityEditorOptions = useMemo(() => entityOptions(org, entityType), [org, entityType]);

  return (
    <div className="space-y-5" dir="rtl">
      {message ? (
        <div className="flex items-center justify-between rounded-2xl border bg-white p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>مسارات الموافقات</CardTitle>
          <CardDescription>الشركة ← نوع الجهة ← اسم الجهة ← نوع الطلب ← مراحل الاعتماد -- عدد غير محدود من المسارات.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={filterCompanyId} onChange={(e) => setFilterCompanyId(e.target.value)}>
              <option value="">كل الشركات</option>
              {org.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={filterEntityType} onChange={(e) => { setFilterEntityType(e.target.value); setFilterEntityId(""); }}>
              <option value="">كل أنواع الجهات</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={filterEntityId} onChange={(e) => setFilterEntityId(e.target.value)} disabled={!filterEntityType}>
              <option value="">كل الجهات</option>
              {entityFilterOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={filterRequestType} onChange={(e) => setFilterRequestType(e.target.value)}>
              <option value="">كل أنواع الطلبات</option>
              {requestTypeOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className="pr-9" />
            </div>
          </div>
          <Button type="button" onClick={openCreate}><Plus className="me-2 h-4 w-4" />مسار موافقة جديد</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-3xl border bg-white p-10 text-center text-muted-foreground dark:bg-slate-900">جاري التحميل...</div>
      ) : paths.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">لا توجد مسارات موافقات مطابقة. أنشئ أول مسار من الزر أعلاه.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paths.map((path) => (
            <Card key={path.id} className="glass-card-premium">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{path.companyName}</p>
                    <p className="font-black truncate">{ENTITY_TYPE_LABELS[path.entityType]}: {path.entityName}</p>
                  </div>
                  <Badge className={path.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{path.isActive ? "نشط" : "متوقف"}</Badge>
                </div>
                <Badge variant="outline" className="font-bold">{path.requestType}</Badge>
                {path.name ? <p className="text-xs text-muted-foreground">{path.name}</p> : null}
                <div className="rounded-2xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
                  <p className="text-xs font-bold mb-1.5">{path.stages.length} مرحلة</p>
                  <ol className="space-y-1 text-xs text-muted-foreground">
                    {path.stages.map((s) => (
                      <li key={s.order} className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{s.order}.</span>
                        <span className="truncate">{s.name || s.approverLabel}</span>
                        {!s.isMandatory ? <Badge variant="outline" className="text-[10px]">اختياري</Badge> : null}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(path)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openDuplicate(path)}><Copy className="h-3.5 w-3.5" />نسخ</Button>
                  {confirmingDeleteId === path.id ? (
                    <>
                      <Button type="button" size="sm" variant="destructive" onClick={() => deletePath(path.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDeleteId(null)}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="text-rose-600" onClick={() => setConfirmingDeleteId(path.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditorOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">{editingId ? "تعديل مسار الموافقة" : "مسار موافقة جديد"}</h2>
              <button type="button" onClick={() => setEditorOpen(false)}><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-bold">الشركة</span>
                  <select className="h-10 w-full rounded-lg border bg-background px-3" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    <option value="">اختر الشركة</option>
                    {org.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-bold">نوع الجهة</span>
                  <select className="h-10 w-full rounded-lg border bg-background px-3" value={entityType} onChange={(e) => { setEntityType(e.target.value); setEntityId(""); }}>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                <MultiSelectChipsDropdown
                  label="اسم الجهة (اختر أكثر من مستشفى/فرع لمسار واحد)"
                  placeholder="اختر مستشفى أو فرع أو عدة جهات دفعة واحدة..."
                  options={entityEditorOptions}
                  selectedIds={entityIds.length > 0 ? entityIds : (entityId ? [entityId] : [])}
                  onChange={(ids) => { setEntityIds(ids); if (ids[0]) setEntityId(ids[0]); }}
                />
                <MultiSelectChipsDropdown
                  label="نوع الطلب (اختر أكثر من طلبات لمسار واحد)"
                  placeholder="اختر نوع طلب أو عدة طلبات لتطبيق نفس المسار..."
                  options={requestTypeOptions.map((t) => ({ id: t.id, name: t.label }))}
                  selectedIds={requestTypes.length > 0 ? requestTypes : (requestType ? [requestType] : [])}
                  onChange={(ids) => { setRequestTypes(ids); if (ids[0]) setRequestType(ids[0]); }}
                  showCustomOption={true}
                  customValue={customRequestType}
                />
                {requestTypes.includes("OTHER") || requestType === "OTHER" ? (
                  <Input placeholder="اكتب نوع الطلب (مثال: تعريف راتب)" value={customRequestType} onChange={(e) => setCustomRequestType(e.target.value)} className="sm:col-span-2" />
                ) : null}
                <Input placeholder="اسم المسار (اختياري)" value={pathName} onChange={(e) => setPathName(e.target.value)} className="sm:col-span-2" />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">مراحل الموافقة ({stages.length})</p>
                  <Button type="button" size="sm" variant="outline" onClick={addStage}><Plus className="h-3.5 w-3.5 me-1" />إضافة مرحلة</Button>
                </div>
                {stages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">لا توجد مراحل بعد -- اضغط "إضافة مرحلة" لبدء بناء المسار يدوياً.</div>
                ) : (
                  <div className="space-y-2">
                    {stages.map((stage, index) => (
                      <div key={index} className="rounded-2xl border p-3 space-y-2 bg-slate-50/60 dark:bg-slate-800/40">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Badge className="shrink-0">{stage.order}</Badge>
                          <Input placeholder="اسم المرحلة (اختياري، مثال: المشرف)" value={stage.name} onChange={(e) => updateStage(index, { name: e.target.value })} className="h-8 flex-1" />
                          <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => moveStage(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => moveStage(index, 1)} disabled={index === stages.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0 text-rose-600" onClick={() => removeStage(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-[220px] flex-1">
                            <UserSearchSelect
                              value={stage.approverEmployeeId || ""}
                              initialLabel={stage.approverLabel || ""}
                              onChange={(userId, label, employee) => updateStage(index, { approverEmployeeId: employee?.id || userId || "", approverLabel: label || "" })}
                              placeholder="اختر الموظف المسؤول عن الموافقة..."
                            />
                          </div>
                          <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold">
                            <input type="checkbox" checked={stage.isMandatory} onChange={(e) => updateStage(index, { isMandatory: e.target.checked })} className="h-4 w-4" />
                            إلزامية
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>إلغاء</Button>
                <Button type="button" onClick={savePath} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ المسار"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
