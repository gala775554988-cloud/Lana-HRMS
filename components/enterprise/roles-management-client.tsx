"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, Check, X, ChevronDown, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSearchSelect } from "@/components/hrms/user-search-select";
import { RESOURCE_LABELS_AR, ACTION_LABELS_AR, CATEGORY_LABELS_AR } from "@/lib/enterprise/permission-labels";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
};
type PermissionTreeAction = { key: string; action: string; label: string };
type PermissionTreeFeature = { resource: string; label: string; granular: boolean; actions: PermissionTreeAction[] };
type PermissionTreeCategory = { key: string; title: string; features: PermissionTreeFeature[]; allPermissions: string[] };

export function RolesManagementClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [tree, setTree] = useState<PermissionTreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [assignUserId, setAssignUserId] = useState("");
  const [assignUserRoles, setAssignUserRoles] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<RoleRow | null>(null);

  const selectedRole = useMemo(() => roles.find((r) => r.id === selectedRoleId) ?? null, [roles, selectedRoleId]);

  function load() {
    setLoading(true);
    fetch("/api/permissions/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setRoles(data.roles ?? []);
        setTree(data.tree ?? []);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function createRole(sourceRole?: RoleRow) {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/permissions/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          permissionKeys: sourceRole?.permissionKeys ?? []
        })
      });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل إنشاء الدور"); return; }
      setNewName("");
      setNewDescription("");
      setCreating(false);
      setMessage(`تم إنشاء الدور "${data.role.name}" بنجاح`);
      load();
    } finally {
      setSaving(false);
    }
  }

  function duplicateRole(role: RoleRow) {
    setNewName(`${role.name}_COPY`);
    setNewDescription(role.description ?? "");
    setCreating(true);
    // Stash the source so the next createRole() call (submit button) clones its permissions.
    setDuplicateSource(role);
  }

  async function saveRoleName(roleId: string) {
    if (!nameDraft.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/permissions/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft.trim() })
      });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل تعديل اسم الدور"); return; }
      setEditingName(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: RoleRow) {
    setSaving(true);
    try {
      const response = await fetch(`/api/permissions/roles/${role.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل حذف الدور"); return; }
      setMessage(`تم حذف الدور "${role.name}"`);
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      load();
    } finally {
      setSaving(false);
      setConfirmingDeleteId(null);
    }
  }

  async function toggleRolePermission(role: RoleRow, permission: string) {
    const next = new Set(role.permissionKeys);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    await savePermissions(role.id, Array.from(next));
  }

  async function toggleRoleFeature(role: RoleRow, feature: PermissionTreeFeature) {
    const keys = feature.actions.map((a) => a.key);
    const allGranted = keys.every((k) => role.permissionKeys.includes(k));
    const next = new Set(role.permissionKeys);
    if (allGranted) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    await savePermissions(role.id, Array.from(next));
  }

  async function toggleRoleCategory(role: RoleRow, category: PermissionTreeCategory) {
    const allGranted = category.allPermissions.every((p) => role.permissionKeys.includes(p));
    const next = new Set(role.permissionKeys);
    if (allGranted) category.allPermissions.forEach((p) => next.delete(p));
    else category.allPermissions.forEach((p) => next.add(p));
    await savePermissions(role.id, Array.from(next));
  }

  async function savePermissions(roleId: string, permissionKeys: string[]) {
    // Optimistic update so checkboxes respond immediately.
    setRoles((current) => current.map((r) => (r.id === roleId ? { ...r, permissionKeys } : r)));
    const response = await fetch(`/api/permissions/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKeys })
    });
    const data = await response.json();
    if (!data.success) { setMessage(data.message || "فشل حفظ صلاحيات الدور"); load(); }
  }

  function toggleCategoryExpanded(key: string) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    if (!assignUserId) { setAssignUserRoles(new Set()); return; }
    setAssignLoading(true);
    fetch(`/api/enterprise/permissions/preview?userId=${encodeURIComponent(assignUserId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return;
        const roleIds = roles.filter((role) => (data.roles ?? []).includes(role.name)).map((role) => role.id);
        setAssignUserRoles(new Set(roleIds));
      })
      .finally(() => setAssignLoading(false));
  }, [assignUserId, roles]);

  async function toggleUserRole(roleId: string) {
    if (!assignUserId) return;
    const has = assignUserRoles.has(roleId);
    const next = new Set(assignUserRoles);
    if (has) next.delete(roleId); else next.add(roleId);
    setAssignUserRoles(next);
    const response = await fetch(`/api/permissions/roles/${roleId}/users`, {
      method: has ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignUserId })
    });
    const data = await response.json();
    if (!data.success) { setMessage(data.message || "فشل تحديث دور المستخدم"); setAssignUserRoles(assignUserRoles); return; }
    load();
  }

  if (loading) {
    return <div className="rounded-3xl border bg-white p-10 text-center text-muted-foreground dark:bg-slate-900">جاري تحميل الأدوار...</div>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      {message ? (
        <div className="flex items-center justify-between rounded-2xl border bg-white p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Roles list + create */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> الأدوار</CardTitle>
            <CardDescription>كل دور يحمل عدداً غير محدود من الصلاحيات المستقلة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {creating ? (
              <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <Input placeholder="اسم الدور (مثال: BRANCH_SUPERVISOR)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder="الوصف (اختياري)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                {duplicateSource ? <p className="text-xs text-muted-foreground">سيتم نسخ {duplicateSource.permissionKeys.length} صلاحية من "{duplicateSource.name}"</p> : null}
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={!newName.trim() || saving} onClick={() => createRole(duplicateSource ?? undefined)}>حفظ</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setCreating(false); setDuplicateSource(null); setNewName(""); setNewDescription(""); }}>إلغاء</Button>
                </div>
              </div>
            ) : (
              <Button type="button" size="sm" className="w-full" onClick={() => { setCreating(true); setDuplicateSource(null); }}>
                <Plus className="me-2 h-4 w-4" /> دور جديد
              </Button>
            )}

            <div className="space-y-1.5">
              {roles.map((role) => (
                <div key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(role.id === selectedRoleId ? null : role.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-start transition ${
                      selectedRoleId === role.id ? "border-primary bg-primary/8" : "border-slate-200 hover:bg-muted/50 dark:border-slate-800"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{role.name}</span>
                        {role.isSystem ? <Badge variant="outline" className="text-[10px]">نظامي</Badge> : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{role.userCount}</span>
                        <span>{role.permissionKeys.length} صلاحية</span>
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${selectedRoleId === role.id ? "rotate-180" : ""}`} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected role editor */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الدور وصلاحياته</CardTitle>
            <CardDescription>اربط أو أزل أي صلاحية من هذا الدور -- يتم الحفظ فوراً ويطبق على جميع مستخدمي الدور.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRole ? (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">اختر دوراً من القائمة لعرض وتعديل صلاحياته.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50/60 p-3 dark:bg-slate-950/30">
                  {editingName === selectedRole.id ? (
                    <div className="flex items-center gap-2">
                      <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="h-8 w-56" disabled={selectedRole.isSystem} />
                      <Button type="button" size="sm" onClick={() => saveRoleName(selectedRole.id)} disabled={saving}><Check className="h-4 w-4" /></Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingName(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black">{selectedRole.name}</span>
                      {selectedRole.description ? <span className="text-xs text-muted-foreground">{selectedRole.description}</span> : null}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {editingName !== selectedRole.id ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => { setEditingName(selectedRole.id); setNameDraft(selectedRole.name); }} disabled={selectedRole.isSystem} title={selectedRole.isSystem ? "لا يمكن إعادة تسمية دور نظامي" : "تعديل الاسم"}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => duplicateRole(selectedRole)}>
                      <Copy className="me-1.5 h-3.5 w-3.5" /> نسخ الدور
                    </Button>
                    {confirmingDeleteId === selectedRole.id ? (
                      <div className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-1.5 py-1 dark:border-rose-900 dark:bg-rose-950/30">
                        <span className="px-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">تأكيد الحذف؟</span>
                        <Button type="button" size="sm" variant="destructive" onClick={() => deleteRole(selectedRole)}><Check className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDeleteId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <Button
                        type="button" size="sm" variant="outline"
                        onClick={() => setConfirmingDeleteId(selectedRole.id)}
                        disabled={selectedRole.isSystem || selectedRole.userCount > 0}
                        title={selectedRole.isSystem ? "لا يمكن حذف دور نظامي" : selectedRole.userCount > 0 ? "أزل جميع المستخدمين من الدور أولاً" : "حذف الدور"}
                        className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {tree.map((category) => {
                    const allGranted = category.allPermissions.every((p) => selectedRole.permissionKeys.includes(p));
                    const someGranted = category.allPermissions.some((p) => selectedRole.permissionKeys.includes(p));
                    const isOpen = expandedCategories.has(category.key);
                    return (
                      <div key={category.key} className="bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-3 bg-slate-50/70 px-4 py-2.5 dark:bg-slate-950/40">
                          <button type="button" onClick={() => toggleCategoryExpanded(category.key)} className="flex flex-1 items-center gap-2 text-start">
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{CATEGORY_LABELS_AR[category.key] ?? category.key}</span>
                            <span className="text-[11px] text-muted-foreground">{category.title}</span>
                          </button>
                          <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${allGranted ? "bg-primary/12 text-primary dark:bg-primary/50 dark:text-primary/30" : someGranted ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "text-slate-500"}`}>
                            <input
                              type="checkbox"
                              checked={allGranted}
                              ref={(el) => { if (el) el.indeterminate = someGranted && !allGranted; }}
                              onChange={() => toggleRoleCategory(selectedRole, category)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            <span>تحديد الكل</span>
                          </label>
                        </div>
                        {isOpen ? (
                          <div className="space-y-1.5 p-3">
                            {category.features.map((feature) => {
                              const keys = feature.actions.map((a) => a.key);
                              const featureAllGranted = keys.every((k) => selectedRole.permissionKeys.includes(k));
                              return (
                                <div key={feature.resource} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50/60 px-3 py-2 dark:bg-slate-950/30">
                                  <label className="flex min-w-[110px] cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    <input type="checkbox" checked={featureAllGranted} onChange={() => toggleRoleFeature(selectedRole, feature)} className="h-3.5 w-3.5 accent-primary" />
                                    <span>{RESOURCE_LABELS_AR[feature.resource] ?? feature.resource}</span>
                                  </label>
                                  <div className="flex flex-wrap items-center gap-3">
                                    {feature.actions.map((permissionAction) => (
                                      <label key={permissionAction.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                        <input type="checkbox" checked={selectedRole.permissionKeys.includes(permissionAction.key)} onChange={() => toggleRolePermission(selectedRole, permissionAction.key)} className="h-3.5 w-3.5 accent-primary" />
                                        <span>{ACTION_LABELS_AR[permissionAction.action] ?? permissionAction.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> تعيين الأدوار للمستخدمين</CardTitle>
          <CardDescription>يمكن إسناد أكثر من دور واحد لنفس المستخدم -- تُدمج صلاحيات كل الأدوار الممنوحة له.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-72"><UserSearchSelect value={assignUserId} onChange={(userId) => setAssignUserId(userId)} /></div>
          {assignUserId ? (
            assignLoading ? (
              <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const checked = assignUserRoles.has(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${checked ? "border-primary/50 bg-primary/8 text-primary dark:border-primary dark:bg-primary/40 dark:text-primary/30" : "border-slate-200 bg-white text-slate-600 hover:border-primary/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleUserRole(role.id)} className="h-4 w-4 accent-primary" />
                      <span>{role.name}</span>
                    </label>
                  );
                })}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
