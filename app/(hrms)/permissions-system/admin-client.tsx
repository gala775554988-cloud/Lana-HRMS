"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Save, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSearchSelect } from "@/components/hrms/user-search-select";
import { PermissionHint } from "@/components/enterprise/permission-hint";

const MODULES = [
  ["employees", "الموظفون"], ["attendance", "الحضور"], ["payroll", "الرواتب"], ["leaves", "الإجازات"],
  ["loans", "السلف"], ["overtime", "الأوفر تايم"], ["documents", "المستندات"], ["contracts", "العقود"],
  ["reports", "التقارير"], ["settings", "الإعدادات"], ["permissions", "الصلاحيات"], ["audit-logs", "سجل التدقيق"],
  ["integrations", "التكاملات"]
] as const;
const SCOPES = [["ALL", "الكل"], ["BRANCH", "الفرع"], ["DEPARTMENT", "الإدارة"], ["HOSPITAL", "مستشفى / موقع"], ["TEAM", "الفريق"], ["SELF", "ذاتي"]] as const;

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
};

type PermissionCategory = { key: string; title: string; permissions: string[] };

function RolesTab({ initialRoles }: { initialRoles: any[] }) {
  const [roles, setRoles] = useState<RoleRecord[]>(
    (initialRoles || []).map((r: any) => ({ id: r.id, name: r.name, description: r.description ?? null, isSystem: Boolean(r.isSystem), userCount: 0, permissionKeys: [] }))
  );
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [draftPermissions, setDraftPermissions] = useState<Set<string>>(new Set());
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleTemplate, setNewRoleTemplate] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch("/api/permissions/roles").then((r) => r.json()).then((d) => {
      setRoles(d.roles || []);
      setCategories(d.categories || []);
      setTemplateKeys(d.templateKeys || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  function selectRole(role: RoleRecord) {
    setSelectedRoleId(role.id);
    setDraftPermissions(new Set(role.permissionKeys));
  }

  function togglePermission(key: string) {
    setDraftPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function createRole() {
    if (!newRoleName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/permissions/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName, description: newRoleDescription, templateKey: newRoleTemplate || undefined })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.success) {
      setMsg("✅ تم إنشاء الدور");
      setNewRoleName(""); setNewRoleDescription(""); setNewRoleTemplate("");
      load();
    } else {
      setMsg("❌ " + (data.message || "فشل إنشاء الدور"));
    }
  }

  async function savePermissions() {
    if (!selectedRole) return;
    setLoading(true);
    const res = await fetch(`/api/permissions/roles/${selectedRole.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKeys: Array.from(draftPermissions) })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.success) { setMsg("✅ تم حفظ صلاحيات الدور"); load(); }
    else setMsg("❌ " + (data.message || "فشل حفظ الصلاحيات"));
  }

  async function removeRole(role: RoleRecord) {
    if (!confirm(`حذف الدور "${role.name}"؟`)) return;
    const res = await fetch(`/api/permissions/roles/${role.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setMsg("✅ تم حذف الدور");
      if (selectedRoleId === role.id) setSelectedRoleId("");
      load();
    } else setMsg("❌ " + (data.message || "فشل حذف الدور"));
  }

  async function assignToUser() {
    if (!selectedRole || !assignUserId) return;
    const res = await fetch(`/api/permissions/roles/${selectedRole.id}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignUserId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) { setMsg("✅ تم تعيين الدور للمستخدم"); setAssignUserId(""); load(); }
    else setMsg("❌ " + (data.message || "فشل تعيين الدور"));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>الأدوار</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className={`w-full rounded-lg border p-3 text-start text-sm transition ${selectedRoleId === role.id ? "border-primary bg-primary/8" : "hover:bg-muted"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{role.name}</span>
                {role.isSystem ? <Badge variant="outline">نظامي</Badge> : <Badge>مخصص</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{role.userCount} مستخدم · {role.permissionKeys.length} صلاحية</div>
            </button>
          ))}

          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-sm font-medium">إنشاء دور جديد</p>
            <Input placeholder="اسم الدور" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
            <Input placeholder="الوصف (اختياري)" value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} />
            <select className="w-full rounded-lg border p-2 text-sm" value={newRoleTemplate} onChange={(e) => setNewRoleTemplate(e.target.value)}>
              <option value="">بدون قالب (بدون صلاحيات)</option>
              {templateKeys.map((key) => <option key={key} value={key}>ابدأ من قالب: {key}</option>)}
            </select>
            <Button onClick={createRole} disabled={loading || !newRoleName.trim()} className="w-full">
              <Plus className="h-4 w-4 ml-1" />إنشاء الدور
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>{selectedRole ? `صلاحيات: ${selectedRole.name}` : "اختر دوراً لتعديل صلاحياته"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!selectedRole ? (
            <p className="text-sm text-muted-foreground">اختر دوراً من القائمة على اليسار.</p>
          ) : (
            <>
              <div className="max-h-96 space-y-3 overflow-auto">
                {categories.map((category) => (
                  <div key={category.key} className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-semibold">{category.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {category.permissions.map((key) => (
                        <label key={key} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${draftPermissions.has(key) ? "border-primary bg-primary/8" : ""}`}>
                          <input type="checkbox" checked={draftPermissions.has(key)} onChange={() => togglePermission(key)} className="h-3.5 w-3.5" />
                          {key}
                          <PermissionHint permission={key} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={savePermissions} disabled={loading}><Save className="h-4 w-4 ml-1" />حفظ الصلاحيات</Button>
                {!selectedRole.isSystem && (
                  <Button variant="destructive" onClick={() => removeRole(selectedRole)}><Trash2 className="h-4 w-4 ml-1" />حذف الدور</Button>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">تعيين هذا الدور لمستخدم</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UserSearchSelect value={assignUserId} onChange={(userId) => setAssignUserId(userId)} />
                  </div>
                  <Button onClick={assignToUser} disabled={!assignUserId}><UserPlus className="h-4 w-4 ml-1" />تعيين</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {msg && <div className="lg:col-span-3 rounded-xl border bg-muted p-3 text-sm" onClick={() => setMsg("")}>{msg}</div>}
    </div>
  );
}

export function PermissionsAdmin({ allRoles, branches, departments, hospitals = [] }: any) {
  const [tab, setTab] = useState<"roles"|"scopes">("roles");
  const [scopes, setScopes] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedModule, setSelectedModule] = useState("employees");
  const [selectedScope, setSelectedScope] = useState("ALL");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/permissions/scope").then(r => r.json()).then(d => setScopes(d.scopes||[])); }, []);

  const saveScope = async () => {
    if (!selectedUserId) {
      setMsg("⚠️ يجب اختيار المستخدم أولاً / Must select a user");
      return;
    }
    if (!selectedScope) {
      setMsg("⚠️ يجب تحديد نطاق الصلاحية / Must select target scope");
      return;
    }
    if (selectedScope === "BRANCH" && !selectedBranchId) {
      setMsg("⚠️ يجب اختيار الفرع المستهدف / Must select target branch");
      return;
    }
    if (selectedScope === "DEPARTMENT" && !selectedDeptId) {
      setMsg("⚠️ يجب اختيار القسم المستهدف / Must select target department");
      return;
    }
    if (selectedScope === "HOSPITAL" && !selectedHospitalId) {
      setMsg("⚠️ يجب اختيار المستشفى المستهدف / Must select target hospital");
      return;
    }

    const res = await fetch("/api/permissions/scope", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, module: selectedModule, scope: selectedScope, branchId: selectedBranchId || null, departmentId: selectedDeptId || null, hospitalId: selectedHospitalId || null }),
    });
    if (res.ok) {
      setMsg("✅ تم حفظ الصلاحية ونطاقها بنجاح");
      setSelectedUserId("");
      setSelectedBranchId("");
      setSelectedDeptId("");
      setSelectedHospitalId("");
      fetch("/api/permissions/scope").then(r=>r.json()).then(d=>setScopes(d.scopes||[]));
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg("❌ " + (err.error || "فشل حفظ نطاق الصلاحية"));
    }
  };

  const removeScope = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف نطاق الصلاحية هذا؟")) return;
    const res = await fetch(`/api/permissions/scope?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setMsg("✅ تم حذف نطاق الصلاحية");
      fetch("/api/permissions/scope").then(r=>r.json()).then(d=>setScopes(d.scopes||[]));
    } else {
      setMsg("❌ فشل حذف نطاق الصلاحية");
    }
  };

  return (
    <div className="space-y-6 p-4" dir="rtl">
      <div className="flex items-center gap-3"><Shield className="h-8 w-8 text-primary" /><h1 className="text-2xl font-black">نظام الصلاحيات المؤسسي</h1></div>
      {msg && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-sm" onClick={()=>setMsg("")}>{msg}</div>}
      <div className="flex gap-2">
        <Button variant={tab==="roles"?"default":"outline"} onClick={()=>setTab("roles")}>الأدوار</Button>
        <Button variant={tab==="scopes"?"default":"outline"} onClick={()=>setTab("scopes")}>نطاق الرؤية</Button>
      </div>

      {tab === "roles" && <RolesTab initialRoles={allRoles} />}

      {tab === "scopes" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>إضافة صلاحية لمستخدم</CardTitle></CardHeader><CardContent className="space-y-3">
            <UserSearchSelect value={selectedUserId} onChange={(userId) => setSelectedUserId(userId)} />
            <select className="w-full border rounded-lg p-2" value={selectedModule} onChange={e=>setSelectedModule(e.target.value)}>
              {MODULES.map(([value, label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <select className="w-full border rounded-lg p-2" value={selectedScope} onChange={e=>setSelectedScope(e.target.value)}>
              {SCOPES.map(([value, label])=><option key={value} value={value}>{label}</option>)}
            </select>
            {selectedScope==="BRANCH" && <select className="w-full border rounded-lg p-2" value={selectedBranchId} onChange={e=>setSelectedBranchId(e.target.value)}><option value="">اختر الفرع</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>}
            {selectedScope==="DEPARTMENT" && <select className="w-full border rounded-lg p-2" value={selectedDeptId} onChange={e=>setSelectedDeptId(e.target.value)}><option value="">اختر القسم</option>{departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}
            {selectedScope==="HOSPITAL" && <select className="w-full border rounded-lg p-2" value={selectedHospitalId} onChange={e=>setSelectedHospitalId(e.target.value)}><option value="">اختر المستشفى / الموقع</option>{hospitals.map((h:any)=><option key={h.id} value={h.id}>{h.name}</option>)}</select>}
            <Button onClick={saveScope} className="w-full"><Save className="h-4 w-4 ml-1"/>حفظ</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>الصلاحيات الحالية ({scopes.length})</CardTitle></CardHeader><CardContent className="max-h-96 overflow-auto space-y-3">
            {scopes.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                لا توجد نطاقات مخصصة حالياً. يتم تطبيق النطاق الافتراضي (كل الشركة).
              </div>
            ) : (
              scopes.map((s: any) => {
                const moduleLabel = MODULES.find(([k]) => k === s.module)?.[1] || s.module;
                const scopeInfo = SCOPES.find(([k]) => k === s.scope)?.[1] || s.scope;
                const targetDetails = s.branchName ? ` (فرع: ${s.branchName})` : s.departmentName ? ` (قسم: ${s.departmentName})` : s.hospitalName ? ` (مستشفى: ${s.hospitalName})` : "";
                return (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 transition hover:border-primary/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary dark:bg-primary/50 dark:text-primary/50 text-xs font-bold">
                        {s.userLabel ? s.userLabel.charAt(0) : "👤"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{s.userLabel || `مستخدم (${s.userId?.slice(0,8)})`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">تم التحديث: {new Date(s.updatedAt || s.createdAt || Date.now()).toLocaleDateString("ar-SA")}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-xs font-semibold bg-primary/80 text-primary dark:bg-primary/40 dark:text-primary/30">
                        {moduleLabel}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-semibold border-primary/20 text-primary dark:border-primary dark:text-primary/50">
                        {scopeInfo}{targetDetails}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50" onClick={() => removeScope(s.id)} title="حذف نطاق الصلاحية">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent></Card>
        </div>
      )}

    </div>
  );
}
