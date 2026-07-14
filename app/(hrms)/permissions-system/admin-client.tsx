"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Users, GitBranch, Save, Plus, Trash2, RefreshCw, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const MODULES = ["employees","attendance","payroll","leaves","loans","overtime","documents","contracts","reports","settings","permissions","audit-logs","integrations"];
const SCOPES = ["ALL","BRANCH","DEPARTMENT","TEAM","SELF"];
const APPROVAL_MODULES = ["leave","overtime","loan","expense"];
const APPROVER_ROLES = ["DIRECT_MANAGER","DEPARTMENT_MANAGER","BRANCH_MANAGER","HR_MANAGER","SUPER_ADMIN"];

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
};

type PermissionCategory = { key: string; title: string; permissions: string[] };

function RolesTab({ allUsers, initialRoles }: { allUsers: any[]; initialRoles: any[] }) {
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
              className={`w-full rounded-lg border p-3 text-start text-sm transition ${selectedRoleId === role.id ? "border-indigo-500 bg-indigo-50" : "hover:bg-muted"}`}
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
                        <label key={key} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${draftPermissions.has(key) ? "border-indigo-500 bg-indigo-50" : ""}`}>
                          <input type="checkbox" checked={draftPermissions.has(key)} onChange={() => togglePermission(key)} className="h-3.5 w-3.5" />
                          {key}
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
                  <select className="flex-1 rounded-lg border p-2 text-sm" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                    <option value="">اختر المستخدم</option>
                    {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.username || u.email}</option>)}
                  </select>
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

export function PermissionsAdmin({ allRoles, allUsers, branches, departments, approvalChains: initialChains }: any) {
  const [tab, setTab] = useState<"roles"|"scopes"|"approval">("roles");
  const [scopes, setScopes] = useState<any[]>([]);
  const [approvalChains, setApprovalChains] = useState(initialChains);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedModule, setSelectedModule] = useState("employees");
  const [selectedScope, setSelectedScope] = useState("ALL");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [approvalModule, setApprovalModule] = useState("leave");
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/permissions/scope").then(r => r.json()).then(d => setScopes(d.scopes||[])); }, []);

  const saveScope = async () => {
    if (!selectedUserId) return;
    const res = await fetch("/api/permissions/scope", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, module: selectedModule, scope: selectedScope, branchId: selectedBranchId || null, departmentId: selectedDeptId || null }),
    });
    if (res.ok) { setMsg("✅ تم حفظ الصلاحية"); setSelectedUserId(""); setSelectedBranchId(""); setSelectedDeptId(""); fetch("/api/permissions/scope").then(r=>r.json()).then(d=>setScopes(d.scopes||[])); }
  };

  const saveApproval = async () => {
    const chain = approvalChains.find((c:any) => c.module === approvalModule);
    const levels = chain?.chain?.map((c:any, i:number) => ({ level: i+1, approverRole: c.approverRole })) || [];
    const res = await fetch("/api/permissions/approval", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: approvalModule, approvals: levels }),
    });
    if (res.ok) setMsg("✅ تم حفظ سلسلة الموافقات");
  };

  const addApprovalLevel = () => {
    setApprovalChains((prev: any) => prev.map((c: any) => c.module === approvalModule ? { ...c, chain: [...(c.chain||[]), { level: (c.chain?.length||0)+1, approverRole: "DIRECT_MANAGER" }] } : c));
  };

  const updateApprovalLevel = (idx: number, role: string) => {
    setApprovalChains((prev: any) => prev.map((c: any) => c.module === approvalModule ? { ...c, chain: c.chain?.map((l: any, i: number) => i === idx ? { ...l, approverRole: role } : l) } : c));
  };

  const removeApprovalLevel = (idx: number) => {
    setApprovalChains((prev: any) => prev.map((c: any) => c.module === approvalModule ? { ...c, chain: c.chain?.filter((_: any, i: number) => i !== idx).map((l: any, i: number) => ({ ...l, level: i+1 })) } : c));
  };

  return (
    <div className="space-y-6 p-4" dir="rtl">
      <div className="flex items-center gap-3"><Shield className="h-8 w-8 text-indigo-600" /><h1 className="text-2xl font-black">نظام الصلاحيات المؤسسي</h1></div>
      {msg && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-sm" onClick={()=>setMsg("")}>{msg}</div>}
      <div className="flex gap-2">
        <Button variant={tab==="roles"?"default":"outline"} onClick={()=>setTab("roles")}>الأدوار</Button>
        <Button variant={tab==="scopes"?"default":"outline"} onClick={()=>setTab("scopes")}>نطاق الرؤية</Button>
        <Button variant={tab==="approval"?"default":"outline"} onClick={()=>setTab("approval")}>سلسلة الموافقات</Button>
      </div>

      {tab === "roles" && <RolesTab allUsers={allUsers} initialRoles={allRoles} />}

      {tab === "scopes" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>إضافة صلاحية لمستخدم</CardTitle></CardHeader><CardContent className="space-y-3">
            <select className="w-full border rounded-lg p-2" value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}>
              <option value="">اختر المستخدم</option>
              {allUsers.map((u:any)=><option key={u.id} value={u.id}>{u.name || u.username || u.email}</option>)}
            </select>
            <select className="w-full border rounded-lg p-2" value={selectedModule} onChange={e=>setSelectedModule(e.target.value)}>
              {MODULES.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <select className="w-full border rounded-lg p-2" value={selectedScope} onChange={e=>setSelectedScope(e.target.value)}>
              {SCOPES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {selectedScope==="BRANCH" && <select className="w-full border rounded-lg p-2" value={selectedBranchId} onChange={e=>setSelectedBranchId(e.target.value)}><option value="">اختر الفرع</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>}
            {selectedScope==="DEPARTMENT" && <select className="w-full border rounded-lg p-2" value={selectedDeptId} onChange={e=>setSelectedDeptId(e.target.value)}><option value="">اختر القسم</option>{departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}
            <Button onClick={saveScope} className="w-full"><Save className="h-4 w-4 ml-1"/>حفظ</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>الصلاحيات الحالية ({scopes.length})</CardTitle></CardHeader><CardContent className="max-h-96 overflow-auto space-y-2">
            {scopes.slice(0,50).map((s:any)=><div key={s.id} className="flex items-center justify-between border rounded-lg p-2 text-sm"><span>{s.userId?.slice(0,8)}...</span><Badge>{s.module}</Badge><Badge variant="outline">{s.scope}</Badge></div>)}
          </CardContent></Card>
        </div>
      )}

      {tab === "approval" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>تعديل سلسلة الموافقات</CardTitle></CardHeader><CardContent className="space-y-3">
            <select className="w-full border rounded-lg p-2" value={approvalModule} onChange={e=>setApprovalModule(e.target.value)}>
              {APPROVAL_MODULES.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            {approvalChains.find((c:any)=>c.module===approvalModule)?.chain?.map((l:any, i:number)=>(
              <div key={i} className="flex items-center gap-2">
                <Badge>المستوى {i+1}</Badge>
                <select className="flex-1 border rounded p-1" value={l.approverRole} onChange={e=>updateApprovalLevel(i,e.target.value)}>
                  {APPROVER_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
                <Button size="sm" variant="destructive" onClick={()=>removeApprovalLevel(i)}><Trash2 className="h-4 w-4"/></Button>
              </div>
            ))}
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={addApprovalLevel}><Plus className="h-4 w-4 ml-1"/>إضافة مستوى</Button><Button size="sm" onClick={saveApproval}><Save className="h-4 w-4 ml-1"/>حفظ السلسلة</Button></div>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
