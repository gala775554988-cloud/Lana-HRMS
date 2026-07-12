"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Users, GitBranch, Save, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const MODULES = ["employees","attendance","payroll","leaves","loans","overtime","documents","contracts","reports","settings","permissions","audit-logs","integrations"];
const SCOPES = ["ALL","BRANCH","DEPARTMENT","TEAM","SELF"];
const APPROVAL_MODULES = ["leave","overtime","loan","expense"];
const APPROVER_ROLES = ["DIRECT_MANAGER","DEPARTMENT_MANAGER","BRANCH_MANAGER","HR_MANAGER","SUPER_ADMIN"];

export function PermissionsAdmin({ allRoles, allUsers, branches, departments, approvalChains: initialChains }: any) {
  const [tab, setTab] = useState<"scopes"|"approval">("scopes");
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
      <div className="flex gap-2"><Button variant={tab==="scopes"?"default":"outline"} onClick={()=>setTab("scopes")}>نطاق الرؤية</Button><Button variant={tab==="approval"?"default":"outline"} onClick={()=>setTab("approval")}>سلسلة الموافقات</Button></div>

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
