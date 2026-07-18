"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Crown, Pencil, Trash2, Check, X, ShieldCheck, ChevronDown, CheckSquare } from "lucide-react";
import { UserSearchSelect } from "@/components/hrms/user-search-select";
import { getPermissionHint } from "@/lib/enterprise/permission-hints";

type PermissionCategory = { key: string; title: string; permissions: string[] };
type PermissionTreeAction = { key: string; action: string; label: string };
type PermissionTreeFeature = { resource: string; label: string; granular: boolean; actions: PermissionTreeAction[] };
type PermissionTreeCategory = { key: string; title: string; features: PermissionTreeFeature[]; allPermissions: string[] };

const RESOURCE_LABELS_AR: Record<string, string> = {
  employees: "الموظفون",
  contracts: "العقود",
  attendance: "الحضور",
  leave: "الإجازات",
  payroll: "الرواتب",
  loans: "السلف",
  allowances: "البدلات",
  deductions: "الاستقطاعات",
  insurance: "التأمين",
  residency: "الإقامات",
  requests: "الطلبات",
  overtime: "العمل الإضافي",
  projects: "المشاريع",
  warehouse: "المستودع",
  assets: "العهد",
  reports: "التقارير",
  documents: "المستندات",
  dashboard: "لوحة التحكم",
  "audit-logs": "سجل التدقيق",
  announcements: "الإعلانات",
  notifications: "الإشعارات",
  settings: "الإعدادات",
  permissions: "الصلاحيات"
};

const ACTION_LABELS_AR: Record<string, string> = {
  read: "مشاهدة",
  create: "إضافة",
  edit: "تعديل",
  delete: "حذف",
  manage: "إدارة"
};

const CATEGORY_LABELS_AR: Record<string, string> = {
  employees: "الموظفون",
  attendance: "الحضور",
  leaves: "الإجازات",
  payroll: "الرواتب",
  insurance: "التأمين",
  residency: "الإقامات",
  requests: "الطلبات",
  projects: "المشاريع",
  warehouse: "المستودع",
  assets: "العهد",
  reports: "التقارير",
  documents: "المستندات",
  administration: "الإدارة",
  settings: "الإعدادات"
};

type EmployeeLite = {
  userId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl?: string | null;
  department?: { name: string } | null;
};

type ActiveEntry = EmployeeLite & {
  grants: Set<string>;
  isDelegate: boolean;
  editingGranular: boolean;
  saving: boolean;
  justSaved: boolean;
  confirmingDelete: boolean;
};

function Avatar({ employee, size = "h-11 w-11" }: { employee: EmployeeLite; size?: string }) {
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  return employee.profilePhotoUrl ? (
    <img src={employee.profilePhotoUrl} alt="" className={`${size} shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-sm dark:ring-slate-900`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/8 to-violet-50 text-sm font-bold text-primary ring-2 ring-white shadow-sm dark:from-primary/50 dark:to-violet-950/40 dark:ring-slate-900`}>
      {initials}
    </div>
  );
}

export function PermissionManagementDashboard() {
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [tree, setTree] = useState<PermissionTreeCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<ActiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      try {
        const [permsRes, delegatesRes] = await Promise.all([
          fetch("/api/enterprise/permissions", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/enterprise/lana-ai/delegates", { cache: "no-store" }).then((r) => r.json())
        ]);
        if (!permsRes.success) throw new Error(permsRes.message || "Failed to load permissions");
        setCategories(permsRes.categories ?? []);
        setTree(permsRes.tree ?? []);

        const delegateIds: string[] = delegatesRes.success ? (delegatesRes.delegateIds ?? []) : [];
        const delegateEmployees: EmployeeLite[] = delegatesRes.success ? (delegatesRes.employees ?? []) : [];

        const grantsByUserId: Record<string, { grants: string[] }> = permsRes.userPermissions ?? {};
        const grantedUserIds = Object.entries(grantsByUserId)
          .filter(([, value]) => (value?.grants?.length ?? 0) > 0)
          .map(([userId]) => userId);

        const missingUserIds = grantedUserIds.filter((id) => !delegateEmployees.some((e) => e.userId === id));
        let resolvedEmployees: EmployeeLite[] = [];
        if (missingUserIds.length) {
          const resolveRes = await fetch("/api/permissions/resolve-users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: missingUserIds })
          }).then((r) => r.json());
          if (resolveRes.success) resolvedEmployees = resolveRes.employees ?? [];
        }

        const allUserIds = Array.from(new Set([...delegateIds, ...grantedUserIds]));
        const byId = new Map<string, EmployeeLite>();
        for (const emp of [...delegateEmployees, ...resolvedEmployees]) byId.set(emp.userId, emp);

        const nextEntries: ActiveEntry[] = allUserIds
          .map((userId) => byId.get(userId))
          .filter((emp): emp is EmployeeLite => Boolean(emp))
          .map((emp) => ({
            ...emp,
            grants: new Set(grantsByUserId[emp.userId]?.grants ?? []),
            isDelegate: delegateIds.includes(emp.userId),
            editingGranular: false,
            saving: false,
            justSaved: false,
            confirmingDelete: false
          }));
        setEntries(nextEntries);
      } catch (error: any) {
        setMessage(error.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateEntry(userId: string, patch: Partial<ActiveEntry>) {
    setEntries((current) => current.map((entry) => (entry.userId === userId ? { ...entry, ...patch } : entry)));
  }

  function addEmployee(employee: any) {
    if (!employee?.userId) return;
    setEntries((current) => {
      if (current.some((entry) => entry.userId === employee.userId)) return current;
      const newEntry: ActiveEntry = {
        userId: employee.userId,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        profilePhotoUrl: employee.profilePhotoUrl ?? null,
        department: employee.department ?? null,
        grants: new Set(),
        isDelegate: false,
        editingGranular: false,
        saving: false,
        justSaved: false,
        confirmingDelete: false
      };
      return [newEntry, ...current];
    });
  }

  async function savePermissions(userId: string, grants: Set<string>) {
    updateEntry(userId, { saving: true });
    try {
      const response = await fetch("/api/enterprise/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, grants: Array.from(grants), operation: "replace" })
      });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل حفظ الصلاحيات"); return; }
      updateEntry(userId, { grants: new Set(data.permissions?.grants ?? Array.from(grants)), justSaved: true });
      setTimeout(() => updateEntry(userId, { justSaved: false }), 2000);
    } finally {
      updateEntry(userId, { saving: false });
    }
  }

  function toggleCategory(entry: ActiveEntry, category: PermissionCategory) {
    const allGranted = category.permissions.every((p) => entry.grants.has(p));
    const nextGrants = new Set(entry.grants);
    if (allGranted) category.permissions.forEach((p) => nextGrants.delete(p));
    else category.permissions.forEach((p) => nextGrants.add(p));
    updateEntry(entry.userId, { grants: nextGrants });
    startTransition(() => savePermissions(entry.userId, nextGrants));
  }

  function toggleSinglePermission(entry: ActiveEntry, permission: string) {
    const nextGrants = new Set(entry.grants);
    if (nextGrants.has(permission)) nextGrants.delete(permission);
    else nextGrants.add(permission);
    updateEntry(entry.userId, { grants: nextGrants });
    startTransition(() => savePermissions(entry.userId, nextGrants));
  }

  function toggleFeatureAll(entry: ActiveEntry, feature: PermissionTreeFeature) {
    const keys = feature.actions.map((a) => a.key);
    const allGranted = keys.every((k) => entry.grants.has(k));
    const nextGrants = new Set(entry.grants);
    if (allGranted) keys.forEach((k) => nextGrants.delete(k));
    else keys.forEach((k) => nextGrants.add(k));
    updateEntry(entry.userId, { grants: nextGrants });
    startTransition(() => savePermissions(entry.userId, nextGrants));
  }

  function toggleCategoryExpanded(key: string) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function toggleLana(entry: ActiveEntry) {
    const nextIsDelegate = !entry.isDelegate;
    updateEntry(entry.userId, { isDelegate: nextIsDelegate, saving: true });
    const nextDelegateIds = entries
      .map((e) => (e.userId === entry.userId ? { ...e, isDelegate: nextIsDelegate } : e))
      .filter((e) => e.isDelegate)
      .map((e) => e.userId);
    try {
      const response = await fetch("/api/enterprise/lana-ai/delegates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: nextDelegateIds })
      });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل تحديث صلاحية لانا"); updateEntry(entry.userId, { isDelegate: entry.isDelegate }); return; }
    } finally {
      updateEntry(entry.userId, { saving: false });
    }
  }

  async function deleteEmployee(entry: ActiveEntry) {
    updateEntry(entry.userId, { saving: true });
    try {
      await fetch("/api/enterprise/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: entry.userId, operation: "remove-all" })
      });
      if (entry.isDelegate) {
        const nextDelegateIds = entries.filter((e) => e.isDelegate && e.userId !== entry.userId).map((e) => e.userId);
        await fetch("/api/enterprise/lana-ai/delegates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: nextDelegateIds })
        });
      }
      setEntries((current) => current.filter((e) => e.userId !== entry.userId));
      setMessage(`تمت إزالة (${entry.firstName} ${entry.lastName}) وسحب جميع صلاحياته / Removed and revoked all access`);
    } catch {
      setMessage("فشل حذف الموظف / Failed to remove employee");
      updateEntry(entry.userId, { saving: false, confirmingDelete: false });
    }
  }

  if (loading) {
    return <div className="rounded-3xl border bg-white p-10 text-center text-muted-foreground dark:bg-slate-900">جاري تحميل لوحة إدارة الصلاحيات...</div>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">لوحة إدارة الصلاحيات / Permission Management Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">ابحث بالاسم أو رقم الهوية أو الرقم الوظيفي لإضافة موظف إلى القائمة أدناه.</p>
        <div className="mt-3 max-w-md">
          <UserSearchSelect value="" onChange={(_userId, _label, employee) => addEmployee(employee)} placeholder="ابحث بالاسم أو رقم الهوية أو الكود الوظيفي..." />
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">{message}</div>
      ) : null}

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900">
            لا يوجد موظفون بصلاحيات مباشرة حالياً. استخدم البحث أعلاه لإضافة أول موظف.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.userId} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-4 p-5">
                <Avatar employee={entry} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.firstName} {entry.lastName}</span>
                    <span className="text-xs text-muted-foreground">({entry.employeeNumber})</span>
                    {entry.isDelegate ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.department?.name ?? "بدون قسم / No department"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateEntry(entry.userId, { editingGranular: !entry.editingGranular })}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-primary/8 hover:text-primary dark:text-slate-400 dark:hover:bg-primary/40"
                    title="تعديل تفصيلي / Edit granular permissions"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {entry.confirmingDelete ? (
                    <div className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-1.5 py-1 dark:border-rose-900 dark:bg-rose-950/30">
                      <span className="px-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">تأكيد الحذف؟</span>
                      <button type="button" onClick={() => deleteEmployee(entry)} className="rounded-lg p-1 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40" aria-label="Confirm delete"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => updateEntry(entry.userId, { confirmingDelete: false })} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cancel"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateEntry(entry.userId, { confirmingDelete: true })}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40"
                      title="حذف / Remove"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <label className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${entry.isDelegate ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>
                  <input type="checkbox" checked={entry.isDelegate} onChange={() => toggleLana(entry)} disabled={entry.saving} className="h-4 w-4 accent-amber-500" />
                  <Crown className="h-3.5 w-3.5" />
                  <span>تفعيل لانا / Enable Lana Access</span>
                </label>
                {categories.map((category) => {
                  const checked = category.permissions.every((p) => entry.grants.has(p));
                  return (
                    <label
                      key={category.key}
                      className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${checked ? "border-primary/50 bg-primary/8 text-primary dark:border-primary dark:bg-primary/40 dark:text-primary/30" : "border-slate-200 bg-white text-slate-600 hover:border-primary/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleCategory(entry, category)} disabled={entry.saving} className="h-4 w-4 accent-primary" />
                      <span>{CATEGORY_LABELS_AR[category.key] ?? category.key} / {category.title}</span>
                    </label>
                  );
                })}
              </div>

              {entry.editingGranular ? (
                <div className="space-y-2.5 border-t border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>هيكل الصلاحيات التفصيلي / Hierarchical permission tree</span>
                    </div>
                    {entry.saving ? (
                      <span className="text-[11px] font-semibold text-primary dark:text-primary/50">جارٍ الحفظ...</span>
                    ) : entry.justSaved ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> تم حفظ التغييرات بنجاح</span>
                    ) : null}
                  </div>

                  <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {tree.map((category) => {
                      const matchingCategory = categories.find((c) => c.key === category.key);
                      const allGranted = category.allPermissions.every((p) => entry.grants.has(p));
                      const someGranted = category.allPermissions.some((p) => entry.grants.has(p));
                      const isOpen = expandedCategories.has(category.key);
                      return (
                        <div key={category.key} className="bg-white dark:bg-slate-900">
                          <div className="flex items-center gap-3 bg-slate-50/70 px-4 py-2.5 dark:bg-slate-950/40">
                            <button
                              type="button"
                              onClick={() => toggleCategoryExpanded(category.key)}
                              className="flex flex-1 items-center gap-2 text-start"
                            >
                              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{CATEGORY_LABELS_AR[category.key] ?? category.key}</span>
                              <span className="text-[11px] text-muted-foreground">{category.title}</span>
                            </button>
                            <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${allGranted ? "bg-primary/12 text-primary dark:bg-primary/50 dark:text-primary/30" : someGranted ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "text-slate-500"}`}>
                              <input
                                type="checkbox"
                                checked={allGranted}
                                ref={(el) => { if (el) el.indeterminate = someGranted && !allGranted; }}
                                onChange={() => matchingCategory && toggleCategory(entry, matchingCategory)}
                                disabled={entry.saving}
                                className="h-3.5 w-3.5 accent-primary"
                              />
                              <CheckSquare className="h-3 w-3" />
                              <span>تحديد الكل</span>
                            </label>
                          </div>

                          {isOpen ? (
                            <div className="space-y-1.5 p-3">
                              {category.features.map((feature) => {
                                const keys = feature.actions.map((a) => a.key);
                                const featureAllGranted = keys.every((k) => entry.grants.has(k));
                                return (
                                  <div key={feature.resource} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50/60 px-3 py-2 dark:bg-slate-950/30">
                                    <label className="flex min-w-[110px] cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      <input type="checkbox" checked={featureAllGranted} onChange={() => toggleFeatureAll(entry, feature)} disabled={entry.saving} className="h-3.5 w-3.5 accent-primary" />
                                      <span>{RESOURCE_LABELS_AR[feature.resource] ?? feature.resource}</span>
                                    </label>
                                    <div className="flex flex-wrap items-center gap-3">
                                      {feature.actions.map((permissionAction) => {
                                        const hint = getPermissionHint(permissionAction.key);
                                        const checked = entry.grants.has(permissionAction.key);
                                        return (
                                          <label key={permissionAction.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400" title={hint.effect}>
                                            <input type="checkbox" checked={checked} onChange={() => toggleSinglePermission(entry, permissionAction.key)} disabled={entry.saving} className="h-3.5 w-3.5 accent-primary" />
                                            <span>{ACTION_LABELS_AR[permissionAction.action] ?? permissionAction.label}</span>
                                          </label>
                                        );
                                      })}
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
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
