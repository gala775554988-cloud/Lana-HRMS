"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

const MODULES = [
  ["employees", "الموظفون"], ["hospitals", "المستشفيات والمواقع"], ["requests", "الطلبات والموافقات"],
  ["attendance", "الحضور والورديات"], ["payroll", "الرواتب"], ["leaves", "الإجازات"],
  ["insurance", "التأمين"], ["social-insurance", "التأمينات الاجتماعية"], ["loans", "السلف"],
  ["overtime", "العمل الإضافي"], ["documents", "المستندات"], ["contracts", "العقود"],
  ["assets", "العهد والأصول"], ["reports", "التقارير"], ["settings", "الإعدادات"],
  ["permissions", "الصلاحيات"], ["audit-logs", "سجل التدقيق"], ["integrations", "التكاملات"],
] as const;

const SCOPES = [
  ["ALL", "كل المنشأة"], ["BRANCH", "فرع محدد"], ["DEPARTMENT", "إدارة محددة"],
  ["HOSPITAL", "مستشفى أو موقع"], ["TEAM", "فريقي المباشر"], ["SELF", "ملف المستخدم فقط"],
] as const;

type NamedEntity = { id: string; name: string };
type ScopeRow = { id: string; userId?: string; userLabel?: string; module: string; scope: string; branchName?: string; departmentName?: string; hospitalName?: string; createdAt?: string; updatedAt?: string };

export function PermissionsAdmin({ branches, departments, hospitals = [] }: { allRoles?: unknown[]; branches: NamedEntity[]; departments: NamedEntity[]; hospitals?: NamedEntity[] }) {
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedModule, setSelectedModule] = useState("employees");
  const [selectedScope, setSelectedScope] = useState("SELF");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const loadScopes = useCallback(async () => {
    const response = await fetch("/api/permissions/scope", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setScopes(data.scopes ?? []);
  }, []);

  useEffect(() => { void loadScopes(); }, [loadScopes]);

  async function saveScope() {
    if (!selectedUserId) return setMessage("اختر المستخدم أولاً.");
    if (selectedScope === "BRANCH" && !selectedBranchId) return setMessage("اختر الفرع المستهدف.");
    if (selectedScope === "DEPARTMENT" && !selectedDeptId) return setMessage("اختر الإدارة المستهدفة.");
    if (selectedScope === "HOSPITAL" && !selectedHospitalId) return setMessage("اختر المستشفى أو الموقع.");
    setSaving(true);
    const response = await fetch("/api/permissions/scope", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, module: selectedModule, scope: selectedScope, branchId: selectedScope === "BRANCH" ? selectedBranchId : null, departmentId: selectedScope === "DEPARTMENT" ? selectedDeptId : null, hospitalId: selectedScope === "HOSPITAL" ? selectedHospitalId : null }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "تعذر حفظ نطاق الوصول.");
    setMessage("تم حفظ نطاق الوصول وتطبيقه على المستخدم.");
    setSelectedUserId("");
    await loadScopes();
  }

  async function removeScope(id: string) {
    if (!window.confirm("هل تريد حذف نطاق الوصول المحدد؟")) return;
    const response = await fetch(`/api/permissions/scope?id=${id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("تعذر حذف نطاق الوصول.");
    setMessage("تم حذف نطاق الوصول.");
    await loadScopes();
  }

  return <div className="space-y-5" dir="rtl">
    <div className="rounded-2xl border bg-card p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Eye className="h-5 w-5" /></div><div><h2 className="text-lg font-black">نطاق الوصول للبيانات</h2><p className="mt-1 text-sm text-muted-foreground">حدد ما يستطيع المستخدم رؤيته داخل كل وحدة. الصلاحية تحدد ما يمكنه فعله، والنطاق يحدد على من يطبّق ذلك.</p></div></div></div>
    {message ? <button type="button" onClick={() => setMessage("")} className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-start text-sm text-emerald-800">{message}</button> : null}
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card><CardHeader><CardTitle>إضافة نطاق وصول</CardTitle><CardDescription>ابدأ بالمستخدم ثم الوحدة ثم مستوى الرؤية.</CardDescription></CardHeader><CardContent className="space-y-3">
        <UserSearchSelect value={selectedUserId} onChange={setSelectedUserId} />
        <label className="block space-y-1.5 text-sm font-semibold"><span>الوحدة</span><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedModule} onChange={(event) => setSelectedModule(event.target.value)}>{MODULES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block space-y-1.5 text-sm font-semibold"><span>نطاق الرؤية</span><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}>{SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {selectedScope === "BRANCH" ? <select aria-label="الفرع" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}><option value="">اختر الفرع</option>{branches.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
        {selectedScope === "DEPARTMENT" ? <select aria-label="الإدارة" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedDeptId} onChange={(event) => setSelectedDeptId(event.target.value)}><option value="">اختر الإدارة</option>{departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
        {selectedScope === "HOSPITAL" ? <select aria-label="المستشفى أو الموقع" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedHospitalId} onChange={(event) => setSelectedHospitalId(event.target.value)}><option value="">اختر المستشفى أو الموقع</option>{hospitals.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
        <Button type="button" onClick={saveScope} disabled={saving} className="w-full"><Save className="me-2 h-4 w-4" />{saving ? "جارٍ الحفظ..." : "حفظ نطاق الوصول"}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>النطاقات المطبقة ({scopes.length})</CardTitle><CardDescription>لا تعني الصلاحية العامة تلقائياً رؤية كل الموظفين؛ النطاق هو المرجع النهائي للرؤية.</CardDescription></CardHeader><CardContent className="max-h-[560px] space-y-2 overflow-y-auto">
        {!scopes.length ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">لا توجد نطاقات مخصصة. المستخدم العادي يرى ملفه فقط تلقائياً.</div> : scopes.map((scope) => {
          const moduleLabel = MODULES.find(([value]) => value === scope.module)?.[1] ?? scope.module;
          const scopeLabel = SCOPES.find(([value]) => value === scope.scope)?.[1] ?? scope.scope;
          const target = scope.branchName || scope.departmentName || scope.hospitalName;
          return <div key={scope.id} className="flex flex-col justify-between gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-bold">{scope.userLabel || `مستخدم ${scope.userId?.slice(0, 8) ?? ""}`}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(scope.updatedAt || scope.createdAt || Date.now()).toLocaleDateString("ar-SA")}</p></div><div className="flex flex-wrap items-center gap-2"><Badge>{moduleLabel}</Badge><Badge variant="outline">{scopeLabel}{target ? ` · ${target}` : ""}</Badge><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => removeScope(scope.id)} title="حذف"><Trash2 className="h-4 w-4" /></Button></div></div>;
        })}
      </CardContent></Card>
    </div>
  </div>;
}
