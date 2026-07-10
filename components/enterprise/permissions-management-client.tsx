"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, KeyRound, Lock, RotateCcw, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PermissionDefinition = { key: string; action: string; resource: string; label: string; labelAr: string };
type PermissionCategory = { key: string; title: string; titleAr: string; system: string; permissions: PermissionDefinition[] };
type EmployeeOption = {
  id: string; employeeNumber: string; firstName: string; lastName: string; email: string | null; userId: string | null; status: string; archivedAt?: string | null;
  department?: { name: string } | null; branch?: { name: string } | null;
  user?: { id: string; username: string | null; name: string | null; email: string | null; isActive: boolean; status: string; isLocked: boolean; lastLoginAt: string | null; loginCount: number; passwordChangedAt: string | null; mustChangePassword: boolean; lockReason: string | null; roles: { role: { id: string; name: string } }[] } | null;
};
type RolePayload = { id: string; name: string; description?: string | null; isSystem: boolean; isEditable: boolean; permissions: string[] };
type Profile = { roles: string[]; inheritedPermissions: string[]; customPermissions: string[]; deniedPermissions: string[]; effectivePermissions: string[]; user: any } | null;
type Payload = { employees: EmployeeOption[]; permissions: string[]; categories: PermissionCategory[]; templates: Record<string, string[]>; userPermissions: Record<string, { grants: string[]; denies: string[] }>; roles: RolePayload[]; auditLogs: any[]; profile: Profile; pagination: { page: number; pageSize: number; total: number; pageCount: number } };

function Switch({ checked, inherited, denied, onClick }: { checked: boolean; inherited?: boolean; denied?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${denied ? "bg-red-500" : checked ? "bg-emerald-600" : inherited ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-700"}`} aria-pressed={checked}>
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked || inherited ? "translate-x-5 rtl:-translate-x-5" : "translate-x-1 rtl:-translate-x-1"}`} />
  </button>;
}

export function PermissionsManagementClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [deniedPermissions, setDeniedPermissions] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState("EMPLOYEE");
  const [search, setSearch] = useState("");
  const [systemFilter, setSystemFilter] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = (userId = selectedUserId) => {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    fetch(`/api/enterprise/permissions?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed");
        setPayload(data);
        const record = userId ? data.userPermissions?.[userId] : null;
        setSelectedPermissions(new Set(record?.grants ?? data.profile?.customPermissions ?? []));
        setDeniedPermissions(new Set(record?.denies ?? data.profile?.deniedPermissions ?? []));
      })
      .catch((error) => setMessage(error.message));
  };

  useEffect(() => { load(""); }, []);

  const selectedEmployee = useMemo(() => payload?.employees.find((employee) => employee.userId === selectedUserId), [payload, selectedUserId]);
  const profile = payload?.profile;
  const inherited = useMemo(() => new Set(profile?.inheritedPermissions ?? []), [profile]);
  const effective = useMemo(() => new Set(profile?.effectivePermissions ?? []), [profile]);
  const systems = useMemo(() => Array.from(new Set(payload?.categories.map((c) => c.system) ?? [])).sort(), [payload]);
  const filteredCategories = useMemo(() => (payload?.categories ?? []).filter((category) => {
    if (systemFilter && category.system !== systemFilter) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return category.title.toLowerCase().includes(needle) || category.titleAr.includes(search) || category.permissions.some((permission) => permission.key.toLowerCase().includes(needle) || permission.label.toLowerCase().includes(needle) || permission.labelAr.includes(search));
  }), [payload, search, systemFilter]);

  const save = (operation: string = "replace", extra: Record<string, unknown> = {}) => {
    if (!selectedUserId) return setMessage("اختر موظفاً أولاً");
    startTransition(async () => {
      const response = await fetch("/api/enterprise/permissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: selectedUserId, grants: Array.from(selectedPermissions), denies: Array.from(deniedPermissions), operation, ...extra }) });
      const data = await response.json();
      setMessage(data.success ? "تم حفظ الصلاحيات وتسجيل العملية في Audit Log" : data.message || "فشل الحفظ");
      if (data.success) load(selectedUserId);
    });
  };

  const toggleGrant = (key: string) => {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setDeniedPermissions((current) => { const next = new Set(current); next.delete(key); return next; });
  };
  const toggleDeny = (key: string) => {
    setDeniedPermissions((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
    setSelectedPermissions((current) => { const next = new Set(current); next.delete(key); return next; });
  };

  const accountAction = async (action: string) => {
    if (!selectedUserId) return;
    const response = await fetch(`/api/enterprise/users/${selectedUserId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json();
    setMessage(data.generatedPassword ? `تم التنفيذ. كلمة المرور المؤقتة: ${data.generatedPassword}` : data.success ? "تم تنفيذ العملية" : data.message);
    load(selectedUserId);
  };
  const employeeAction = async (action: string) => {
    if (!selectedEmployee?.id) return;
    const response = await fetch(`/api/enterprise/employees/${selectedEmployee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json();
    setMessage(data.success ? "تم تنفيذ العملية" : data.message);
    load(selectedUserId);
  };

  if (!payload) return <Card><CardContent className="p-6">جاري تحميل نظام الصلاحيات...</CardContent></Card>;

  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]" dir="rtl">
    <Card className="xl:sticky xl:top-20 xl:self-start">
      <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> الموظفون</CardTitle><CardDescription>اختر موظفاً لإدارة صلاحياته المباشرة بدون تعديل Role</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><input className="h-10 w-full rounded-md border bg-background pr-9 text-sm" placeholder="بحث سريع" onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="max-h-[520px] overflow-auto rounded-xl border">
          {payload.employees.map((employee) => <button key={employee.id} type="button" onClick={() => { setSelectedUserId(employee.userId || ""); load(employee.userId || ""); }} className={`w-full border-b p-3 text-right text-sm transition hover:bg-muted ${selectedUserId === employee.userId ? "bg-primary/10" : ""}`}>
            <div className="font-semibold">{employee.firstName} {employee.lastName}</div>
            <div className="text-xs text-muted-foreground">{employee.employeeNumber} · {employee.department?.name ?? "-"}</div>
            <div className="mt-1 flex gap-1"><Badge variant="outline">{employee.user?.roles?.[0]?.role.name ?? "NO_ROLE"}</Badge>{employee.user?.isLocked && <Badge variant="warning">Locked</Badge>}</div>
          </button>)}
        </div>
      </CardContent>
    </Card>

    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> الحساب والصلاحيات الفعالة</CardTitle><CardDescription>Role + Inherited Permissions + Custom Permissions + Effective Permissions</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {!selectedEmployee ? <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">اختر موظفاً من القائمة</div> : <>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="اسم المستخدم" value={selectedEmployee.user?.username || selectedEmployee.user?.email || "-"} />
              <Info label="الدور" value={profile?.roles.join(", ") || selectedEmployee.user?.roles.map((r) => r.role.name).join(", ") || "-"} />
              <Info label="الحالة" value={selectedEmployee.user?.isActive ? "Active" : "Disabled"} />
              <Info label="آخر تسجيل دخول" value={selectedEmployee.user?.lastLoginAt ? new Date(selectedEmployee.user.lastLoginAt).toLocaleString("ar-SA") : "-"} />
              <Info label="عدد مرات الدخول" value={String(selectedEmployee.user?.loginCount ?? 0)} />
              <Info label="آخر تغيير كلمة المرور" value={selectedEmployee.user?.passwordChangedAt ? new Date(selectedEmployee.user.passwordChangedAt).toLocaleString("ar-SA") : "-"} />
              <Info label="يجب تغيير كلمة المرور؟" value={selectedEmployee.user?.mustChangePassword ? "نعم" : "لا"} />
              <Info label="الحساب مقفل؟" value={selectedEmployee.user?.isLocked ? `نعم - ${selectedEmployee.user.lockReason ?? ""}` : "لا"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => accountAction("reset-password")}><KeyRound className="ms-2 h-4 w-4" />Reset Password</Button>
              <Button variant="outline" onClick={() => accountAction("force-password-change")}>Force Password Change</Button>
              <Button variant="outline" onClick={() => accountAction("unlock-account")}><Lock className="ms-2 h-4 w-4" />Unlock Account</Button>
              <Button variant="outline" onClick={() => accountAction("disable-account")}>Disable Account</Button>
              <Button variant="outline" onClick={() => accountAction("enable-account")}>Enable Account</Button>
              <Button variant="outline" onClick={() => employeeAction("archive-employee")}>Archive Employee</Button>
              <Button variant="outline" onClick={() => employeeAction("restore-employee")}>Restore Employee</Button>
              <Button variant="outline" onClick={() => setMessage("تم تجهيز أمر الإرسال - اربط SMTP للإرسال الفعلي")}>Send Welcome Email</Button>
            </div>
          </>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> شجرة الصلاحيات</CardTitle><CardDescription>كل صلاحية Switch مستقل. الأزرق = موروث من Role، الأخضر = Custom Grant، الأحمر = Deny.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Permission" className="h-10 rounded-md border bg-background px-3 text-sm" />
            <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">كل الأنظمة</option>{systems.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={template} onChange={(e) => setTemplate(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">{Object.keys(payload.templates).map((key) => <option key={key}>{key}</option>)}</select>
            <Button type="button" variant="outline" onClick={() => setSelectedPermissions(new Set(payload.permissions))}>Select All</Button>
            <Button type="button" variant="outline" onClick={() => { setSelectedPermissions(new Set()); setDeniedPermissions(new Set()); }}>Clear All</Button>
            <Button type="button" variant="outline" onClick={() => setSelectedPermissions(new Set(payload.templates[template] ?? []))}>Apply Role Template</Button>
            <Button type="button" disabled={isPending || !selectedUserId} onClick={() => save("replace")}><Check className="ms-2 h-4 w-4" />حفظ</Button>
            <Button type="button" variant="outline" onClick={() => load(selectedUserId)}><RotateCcw className="ms-2 h-4 w-4" />تحديث</Button>
          </div>
          {message && <div className="rounded-lg border bg-muted p-3 text-sm">{message}</div>}
          <div className="space-y-3">
            {filteredCategories.map((category) => <details key={category.key} open className="rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold"><span>{category.titleAr} / {category.title}</span><Badge variant="outline">{category.system}</Badge><ChevronDown className="h-4 w-4" /></summary>
              <div className="grid gap-2 border-t p-3 md:grid-cols-2">
                {category.permissions.map((permission) => {
                  const custom = selectedPermissions.has(permission.key);
                  const denied = deniedPermissions.has(permission.key);
                  const isInherited = inherited.has(permission.key);
                  const isEffective = effective.has(permission.key) || custom || (isInherited && !denied);
                  return <div key={permission.key} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div><div className="font-medium">{permission.labelAr} <span className="text-muted-foreground">/ {permission.label}</span></div><code className="text-xs text-muted-foreground">{permission.key}</code></div>
                    <div className="flex items-center gap-3"><Switch checked={custom || isEffective} inherited={isInherited && !custom} denied={denied} onClick={() => toggleGrant(permission.key)} /><button type="button" onClick={() => toggleDeny(permission.key)} className={`rounded px-2 py-1 text-xs ${denied ? "bg-red-600 text-white" : "border"}`}>OFF</button></div>
                  </div>;
                })}
              </div>
            </details>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Roles قابلة للتعديل و Audit Log</CardTitle><CardDescription>ملخص الأدوار الحالية وآخر تغييرات الصلاحيات.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="max-h-80 overflow-auto rounded-xl border">{payload.roles.map((role) => <div key={role.id} className="border-b p-3 text-sm"><div className="font-semibold">{role.name} <Badge variant="outline">{role.permissions.length}</Badge></div><div className="text-xs text-muted-foreground">{role.isEditable ? "Editable" : "System protected"}</div></div>)}</div>
          <div className="max-h-80 overflow-auto rounded-xl border">{payload.auditLogs.map((log) => <div key={log.id} className="border-b p-3 text-xs"><div className="font-semibold">{log.action} · {new Date(log.createdAt).toLocaleString("ar-SA")}</div><div className="text-muted-foreground">By: {log.actor?.name ?? log.actor?.email ?? "-"} · IP: {log.ipAddress ?? "-"}</div></div>)}</div>
        </CardContent>
      </Card>
    </div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-semibold">{value}</div></div>;
}
