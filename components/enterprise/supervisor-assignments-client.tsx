"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, Check, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

const ENTITY_TYPE_LABELS: Record<string, string> = { HOSPITAL: "مستشفى", DEPARTMENT: "إدارة", BRANCH: "فرع", PROJECT: "مشروع" };
const ENTITY_TYPES = ["HOSPITAL", "DEPARTMENT", "BRANCH", "PROJECT"] as const;

type OrgEntities = {
  hospitals: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  projects: { id: string; name: string }[];
};
const emptyOrg: OrgEntities = { hospitals: [], departments: [], branches: [], projects: [] };

function entityOptions(org: OrgEntities, entityType: string) {
  if (entityType === "HOSPITAL") return org.hospitals;
  if (entityType === "DEPARTMENT") return org.departments;
  if (entityType === "BRANCH") return org.branches;
  if (entityType === "PROJECT") return org.projects;
  return [];
}

type AssignmentRow = {
  id: string; employeeId: string; employeeLabel: string; entityType: string; entityId: string; entityName: string;
  title: string | null; startDate: string; endDate: string | null; isActive: boolean;
};

export function SupervisorAssignmentsClient() {
  const [org, setOrg] = useState<OrgEntities>(emptyOrg);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterActive, setFilterActive] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [entityType, setEntityType] = useState<string>("HOSPITAL");
  const [entityId, setEntityId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const loadOrg = () => fetch("/api/enterprise/org-entities").then((r) => r.json()).then((d) => { if (d.success) setOrg(d); });
  const loadAssignments = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterEntityType) params.set("entityType", filterEntityType);
    if (filterActive) params.set("isActive", filterActive);
    fetch(`/api/enterprise/supervisor-assignments?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setAssignments(d.assignments); else setMessage(d.message || "فشل تحميل التكليفات"); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrg(); }, []);
  useEffect(() => { loadAssignments(); }, [filterEntityType, filterActive]);

  function openCreate() {
    setEmployeeId(""); setEmployeeLabel(""); setEntityType("HOSPITAL"); setEntityId("");
    setTitle(""); setStartDate(new Date().toISOString().slice(0, 10)); setEndDate("");
    setFormOpen(true);
  }

  async function saveAssignment() {
    if (!employeeId || !entityId || !startDate) { setMessage("الموظف، الجهة، وتاريخ البداية كلها مطلوبة"); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/enterprise/supervisor-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, entityType, entityId, title: title || undefined, startDate, endDate: endDate || undefined })
      });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل حفظ التكليف"); return; }
      setMessage("تم حفظ التكليف بنجاح");
      setFormOpen(false);
      loadAssignments();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(assignment: AssignmentRow) {
    const response = await fetch(`/api/enterprise/supervisor-assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !assignment.isActive })
    });
    const data = await response.json();
    if (!data.success) { setMessage(data.message || "فشل التحديث"); return; }
    loadAssignments();
  }

  async function deleteAssignment(id: string) {
    const response = await fetch(`/api/enterprise/supervisor-assignments/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.success) { setMessage(data.message || "فشل حذف التكليف"); return; }
    setConfirmingDeleteId(null);
    loadAssignments();
  }

  const entityFormOptions = useMemo(() => entityOptions(org, entityType), [org, entityType]);

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
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />تكليفات المشرفين</CardTitle>
          <CardDescription>تعيين موظف كمشرف/مدير على جهة معينة يُعيد تلقائياً تحديد نطاق فريقه وطلباته وحضوره.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
              <option value="">كل أنواع الجهات</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="true">نشط</option>
              <option value="false">غير نشط</option>
            </select>
          </div>
          <Button type="button" onClick={openCreate}><Plus className="me-2 h-4 w-4" />تكليف جديد</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-3xl border bg-white p-10 text-center text-muted-foreground dark:bg-slate-900">جاري التحميل...</div>
      ) : assignments.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">لا توجد تكليفات مطابقة.</div>
      ) : (
        <div className="grid gap-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{assignment.employeeLabel}</p>
                  {assignment.title ? <Badge variant="outline">{assignment.title}</Badge> : null}
                  <Badge className={assignment.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{assignment.isActive ? "نشط" : "غير نشط"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ENTITY_TYPE_LABELS[assignment.entityType]}: {assignment.entityName} · من {new Date(assignment.startDate).toLocaleDateString("ar-SA")}
                  {assignment.endDate ? ` إلى ${new Date(assignment.endDate).toLocaleDateString("ar-SA")}` : " (بدون نهاية)"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => toggleActive(assignment)}>{assignment.isActive ? "إيقاف" : "تفعيل"}</Button>
                {confirmingDeleteId === assignment.id ? (
                  <>
                    <Button type="button" size="sm" variant="destructive" onClick={() => deleteAssignment(assignment.id)}><Check className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDeleteId(null)}><X className="h-3.5 w-3.5" /></Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="text-rose-600" onClick={() => setConfirmingDeleteId(assignment.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">تكليف مشرف جديد</h2>
              <button type="button" onClick={() => setFormOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="space-y-1.5 text-sm block">
                <span className="font-bold">الموظف</span>
                <UserSearchSelect value={employeeId || ""} initialLabel={employeeLabel} onChange={(userId, label, employee) => { setEmployeeId(employee?.id || userId || ""); setEmployeeLabel(label || ""); }} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-bold">نوع الجهة</span>
                  <select className="h-10 w-full rounded-lg border bg-background px-3" value={entityType} onChange={(e) => { setEntityType(e.target.value); setEntityId(""); }}>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-bold">اسم الجهة</span>
                  <select className="h-10 w-full rounded-lg border bg-background px-3" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
                    <option value="">اختر الجهة</option>
                    {entityFormOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </label>
              </div>
              <Input placeholder="المسمى داخل المسار (مثال: مشرف، مدير مستشفى) -- اختياري" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-bold">تاريخ البداية</span>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-bold">تاريخ النهاية (اختياري)</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
                <Button type="button" onClick={saveAssignment} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التكليف"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
