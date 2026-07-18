"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Users, GitBranch, Save, Plus, Trash2, RefreshCw, UserPlus, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { UserSearchSelect } from "@/components/hrms/user-search-select";
import { PermissionHint } from "@/components/enterprise/permission-hint";

const CAPABILITIES = [["VIEW", "إظهار فقط"], ["APPROVE", "موافقة"], ["REJECT", "رفض"]] as const;

function capabilityLabel(key: string) {
  return CAPABILITIES.find(([value]) => value === key)?.[1] ?? key;
}

function roleLabel(role: string) {
  return APPROVER_ROLES.find(([value]) => value === role)?.[1] ?? role;
}

const MODULES = [
  ["employees", "الموظفون"], ["attendance", "الحضور"], ["payroll", "الرواتب"], ["leaves", "الإجازات"],
  ["loans", "السلف"], ["overtime", "الأوفر تايم"], ["documents", "المستندات"], ["contracts", "العقود"],
  ["reports", "التقارير"], ["settings", "الإعدادات"], ["permissions", "الصلاحيات"], ["audit-logs", "سجل التدقيق"],
  ["integrations", "التكاملات"]
] as const;
const SCOPES = [["ALL", "الكل"], ["BRANCH", "الفرع"], ["DEPARTMENT", "الإدارة"], ["HOSPITAL", "مستشفى / موقع"], ["TEAM", "الفريق"], ["SELF", "ذاتي"]] as const;
const APPROVAL_MODULES = [["leave", "الإجازات"], ["overtime", "الأوفر تايم"], ["loan", "السلف"], ["expense", "المصروفات"]] as const;
const APPROVER_ROLES = [
  ["DIRECT_MANAGER", "المدير المباشر"], ["DEPARTMENT_MANAGER", "مدير الإدارة"], ["BRANCH_MANAGER", "مدير الفرع"],
  ["HR_MANAGER", "مدير الموارد البشرية"], ["SUPER_ADMIN", "المدير العام"]
] as const;

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

export function PermissionsAdmin({ allRoles, branches, departments, hospitals = [], approvalChains: initialChains }: any) {
  const [tab, setTab] = useState<"roles"|"scopes"|"approval">("roles");
  const [scopes, setScopes] = useState<any[]>([]);
  const [approvalChains, setApprovalChains] = useState(initialChains);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedModule, setSelectedModule] = useState("employees");
  const [selectedScope, setSelectedScope] = useState("ALL");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [approvalModule, setApprovalModule] = useState("leave");
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const [showAddLevel, setShowAddLevel] = useState(false);
  const [draftAssignMode, setDraftAssignMode] = useState<"ROLE" | "PERSON">("ROLE");
  const [draftRole, setDraftRole] = useState("DIRECT_MANAGER");
  const [draftUserId, setDraftUserId] = useState("");
  const [draftScopeType, setDraftScopeType] = useState<"GLOBAL" | "BRANCH" | "HOSPITAL">("GLOBAL");
  const [draftScopeId, setDraftScopeId] = useState("");
  const [draftCapabilities, setDraftCapabilities] = useState<Set<string>>(new Set(["VIEW", "APPROVE", "REJECT"]));

  useEffect(() => { fetch("/api/permissions/scope").then(r => r.json()).then(d => setScopes(d.scopes||[])); }, []);

  useEffect(() => {
    const allUserIds = (approvalChains as any[]).flatMap((c: any) => c.chain?.map((l: any) => l.approverUserId).filter(Boolean) ?? []);
    const missing = Array.from(new Set(allUserIds as string[])).filter((id) => !userLabels[id]);
    if (!missing.length) return;
    fetch("/api/permissions/resolve-users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: missing }),
    }).then((r) => r.json()).then((d) => { if (d.success) setUserLabels((prev) => ({ ...prev, ...d.labels })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalChains]);

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

  const saveApproval = async () => {
    const chain = approvalChains.find((c:any) => c.module === approvalModule);
    const levels = chain?.chain?.map((c:any, i:number) => ({
      level: i + 1,
      approverRole: c.approverRole,
      approverUserId: c.approverUserId || null,
      scopeType: c.scopeType || "GLOBAL",
      scopeId: c.scopeId || "",
      capabilities: c.capabilities?.length ? c.capabilities : ["VIEW", "APPROVE", "REJECT"]
    })) || [];
    const res = await fetch("/api/permissions/approval", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: approvalModule, approvals: levels }),
    });
    if (res.ok) setMsg("✅ تم حفظ سلسلة الموافقات");
  };

  const openAddLevel = () => {
    setDraftAssignMode("ROLE");
    setDraftRole("DIRECT_MANAGER");
    setDraftUserId("");
    setDraftScopeType("GLOBAL");
    setDraftScopeId("");
    setDraftCapabilities(new Set(["VIEW", "APPROVE", "REJECT"]));
    setShowAddLevel(true);
  };

  const toggleDraftCapability = (key: string) => {
    setDraftCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const confirmAddLevel = () => {
    if (draftAssignMode === "PERSON" && !draftUserId) return;
    if (draftScopeType !== "GLOBAL" && !draftScopeId) return;
    const newLevel = {
      level: 0,
      approverRole: draftAssignMode === "ROLE" ? draftRole : "DIRECT_MANAGER",
      approverUserId: draftAssignMode === "PERSON" ? draftUserId : null,
      scopeType: draftScopeType,
      scopeId: draftScopeType === "GLOBAL" ? "" : draftScopeId,
      capabilities: Array.from(draftCapabilities)
    };
    setApprovalChains((prev: any) => prev.map((c: any) => c.module === approvalModule ? { ...c, chain: [...(c.chain||[]), newLevel].map((l: any, i: number) => ({ ...l, level: i + 1 })) } : c));
    setShowAddLevel(false);
  };

  const removeApprovalLevel = (idx: number) => {
    setApprovalChains((prev: any) => prev.map((c: any) => c.module === approvalModule ? { ...c, chain: c.chain?.filter((_: any, i: number) => i !== idx).map((l: any, i: number) => ({ ...l, level: i+1 })) } : c));
  };

  return (
    <div className="space-y-6 p-4" dir="rtl">
      <div className="flex items-center gap-3"><Shield className="h-8 w-8 text-primary" /><h1 className="text-2xl font-black">نظام الصلاحيات المؤسسي</h1></div>
      {msg && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-sm" onClick={()=>setMsg("")}>{msg}</div>}
      <div className="flex gap-2">
        <Button variant={tab==="roles"?"default":"outline"} onClick={()=>setTab("roles")}>الأدوار</Button>
        <Button variant={tab==="scopes"?"default":"outline"} onClick={()=>setTab("scopes")}>نطاق الرؤية</Button>
        <Button variant={tab==="approval"?"default":"outline"} onClick={()=>setTab("approval")}>سلسلة الموافقات</Button>
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

      {tab === "approval" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>تعديل سلسلة الموافقات</CardTitle></CardHeader><CardContent className="space-y-3">
            <select className="w-full border rounded-lg p-2" value={approvalModule} onChange={e=>setApprovalModule(e.target.value)}>
              {APPROVAL_MODULES.map(([value, label])=><option key={value} value={value}>{label}</option>)}
            </select>
            {approvalChains.find((c:any)=>c.module===approvalModule)?.chain?.map((l:any, i:number)=>(
              <div key={i} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <Badge>المستوى {i+1}</Badge>
                  <Button size="sm" variant="destructive" onClick={()=>removeApprovalLevel(i)}><Trash2 className="h-4 w-4"/></Button>
                </div>
                <div className="text-sm">
                  {l.approverUserId
                    ? <span>شخص محدد: <strong>{userLabels[l.approverUserId] || l.approverUserId}</strong></span>
                    : <span>حسب الدور: <strong>{roleLabel(l.approverRole)}</strong></span>}
                </div>
                {l.scopeType && l.scopeType !== "GLOBAL" && l.scopeId ? (
                  <div className="text-xs text-muted-foreground">
                    النطاق: {l.scopeType === "BRANCH" ? "فرع" : "مستشفى"} — {
                      l.scopeType === "BRANCH"
                        ? (branches.find((b: any) => b.id === l.scopeId)?.name ?? l.scopeId)
                        : (hospitals.find((h: any) => h.id === l.scopeId)?.name ?? l.scopeId)
                    }
                  </div>
                ) : null}
                <div className="flex gap-1.5">
                  {CAPABILITIES.map(([key, label]) => (
                    <Badge key={key} variant={(l.capabilities ?? ["VIEW","APPROVE","REJECT"]).includes(key) ? "default" : "outline"}>{label}</Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={openAddLevel}><Plus className="h-4 w-4 ml-1"/>إضافة مستوى</Button><Button size="sm" onClick={saveApproval}><Save className="h-4 w-4 ml-1"/>حفظ السلسلة</Button></div>
          </CardContent></Card>
        </div>
      )}

      <Dialog open={showAddLevel} onOpenChange={setShowAddLevel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة مستوى موافقة</DialogTitle>
            <DialogClose onClick={() => setShowAddLevel(false)} />
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" type="button" variant={draftAssignMode==="ROLE"?"default":"outline"} onClick={() => setDraftAssignMode("ROLE")}>حسب الدور</Button>
              <Button size="sm" type="button" variant={draftAssignMode==="PERSON"?"default":"outline"} onClick={() => setDraftAssignMode("PERSON")}><UserPlus className="h-4 w-4 ml-1" />شخص محدد بالاسم</Button>
            </div>

            {draftAssignMode === "ROLE" ? (
              <select className="w-full rounded-lg border p-2" value={draftRole} onChange={(e) => setDraftRole(e.target.value)}>
                {APPROVER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : (
              <UserSearchSelect
                value={draftUserId}
                onChange={(userId, label) => { setDraftUserId(userId); if (userId && label) setUserLabels((prev) => ({ ...prev, [userId]: label })); }}
              />
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium">تحديد المسؤول حسب المستشفى/الفرع (اختياري)</p>
              <select className="w-full rounded-lg border p-2" value={draftScopeType} onChange={(e) => { setDraftScopeType(e.target.value as any); setDraftScopeId(""); }}>
                <option value="GLOBAL">عام (كل الفروع/المستشفيات)</option>
                <option value="BRANCH">حسب الفرع</option>
                <option value="HOSPITAL">حسب المستشفى</option>
              </select>
              {draftScopeType === "BRANCH" && (
                <select className="mt-2 w-full rounded-lg border p-2" value={draftScopeId} onChange={(e) => setDraftScopeId(e.target.value)}>
                  <option value="">اختر الفرع</option>
                  {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {draftScopeType === "HOSPITAL" && (
                <select className="mt-2 w-full rounded-lg border p-2" value={draftScopeId} onChange={(e) => setDraftScopeId(e.target.value)}>
                  <option value="">اختر المستشفى</option>
                  {hospitals.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">صلاحية هذا المستوى</p>
              <div className="flex gap-4">
                {CAPABILITIES.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={draftCapabilities.has(key)} onChange={() => toggleDraftCapability(key)} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={confirmAddLevel}
              disabled={(draftAssignMode === "PERSON" && !draftUserId) || (draftScopeType !== "GLOBAL" && !draftScopeId)}
              className="w-full"
            >
              إضافة المستوى
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
