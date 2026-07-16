"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, Crown, Eye, HelpCircle, Lock, RotateCcw, ShieldCheck, SlidersHorizontal, UserCog, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PermissionHint } from "@/components/enterprise/permission-hint";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

const SENSITIVE_FIELDS = ["nationalId", "email", "phone", "profilePhotoUrl", "address", "emergencyContact", "dateOfBirth"] as const;
const FIELD_LABELS: Record<(typeof SENSITIVE_FIELDS)[number], string> = {
  nationalId: "رقم الهوية / National ID",
  email: "البريد الإلكتروني / Email",
  phone: "رقم الهاتف / Phone",
  profilePhotoUrl: "الصورة الشخصية / Photo",
  address: "العنوان / Address",
  emergencyContact: "جهة اتصال الطوارئ / Emergency contact",
  dateOfBirth: "تاريخ الميلاد / Date of birth"
};
const FIELD_HINTS: Record<(typeof SENSITIVE_FIELDS)[number], string> = {
  nationalId: "عرض: يرى الرقم عند فتح ملف أي موظف. تعديل: يمكنه تغييره. إخفاء: لا يظهر له إطلاقاً في أي شاشة أو أداة (بما فيها لانا AI).",
  email: "عرض: يرى بريد الموظف. تعديل: يمكنه تغييره. إخفاء: لا يظهر له إطلاقاً.",
  phone: "عرض: يرى رقم الهاتف. تعديل: يمكنه تغييره. إخفاء: لا يظهر له إطلاقاً.",
  profilePhotoUrl: "عرض: يرى صورة الموظف. تعديل: يمكنه تغييرها. إخفاء: لا تظهر له الصورة إطلاقاً (بما فيها عبر لانا AI).",
  address: "عرض: يرى عنوان الموظف. تعديل: يمكنه تغييره. إخفاء: لا يظهر له إطلاقاً.",
  emergencyContact: "عرض: يرى جهة اتصال الطوارئ. تعديل: يمكنه تغييرها. إخفاء: لا تظهر له إطلاقاً.",
  dateOfBirth: "عرض: يرى تاريخ الميلاد. تعديل: يمكنه تغييره. إخفاء: لا يظهر له إطلاقاً."
};
type FieldAccessLevel = "VIEW" | "EDIT" | "HIDDEN";
type FieldAccessMap = Partial<Record<(typeof SENSITIVE_FIELDS)[number], FieldAccessLevel>>;

function FieldHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}
        className="rounded-full text-muted-foreground transition hover:text-foreground"
        aria-label="field hint"
        aria-expanded={open}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span
          role="tooltip"
          onClick={(event) => event.stopPropagation()}
          className="absolute end-0 top-full z-50 mt-1.5 w-64 rounded-lg border bg-popover p-2.5 text-xs leading-5 text-popover-foreground shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

type PreviewData = {
  employee: { name: string; employeeNumber: string; department: string | null; branch: string | null } | null;
  roles: string[];
  isSuperAdmin: boolean;
  categories: Array<{ key: string; title: string; permissions: Array<{ key: string; granted: boolean }> }>;
  modules: Array<{ key: string; title: string; visible: boolean }>;
};

type PermissionCategory = { key: string; title: string; permissions: string[] };
type EmployeeOption = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  userId: string | null;
  department?: { name: string } | null;
  branch?: { name: string } | null;
  user?: { id: string; name: string | null; email: string | null; roles: { role: { name: string } }[] } | null;
};

type Payload = {
  employees: EmployeeOption[];
  permissions: string[];
  categories: PermissionCategory[];
  templates: Record<string, string[]>;
  userPermissions: Record<string, { grants: string[]; denies: string[]; temporaryGrants?: Record<string, string> }>;
};

export function PermissionsManagementClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedEmployeeInfo, setSelectedEmployeeInfo] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [copySourceUserId, setCopySourceUserId] = useState<string>("");
  const [template, setTemplate] = useState<string>("EMPLOYEE");
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fieldAccess, setFieldAccess] = useState<FieldAccessMap>({});
  const [fieldAccessMessage, setFieldAccessMessage] = useState("");
  const [delegateEmployees, setDelegateEmployees] = useState<Array<{ userId: string; employeeNumber: string; firstName: string; lastName: string }>>([]);
  const [newDelegateUserId, setNewDelegateUserId] = useState("");
  const [delegatesMessage, setDelegatesMessage] = useState("");

  const loadDelegates = () => {
    fetch("/api/enterprise/lana-ai/delegates", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (data.success) setDelegateEmployees(data.employees ?? []); })
      .catch(() => {});
  };

  useEffect(() => { loadDelegates(); }, []);

  function addDelegate() {
    if (!newDelegateUserId) return;
    const nextIds = Array.from(new Set([...delegateEmployees.map((e) => e.userId), newDelegateUserId]));
    startTransition(async () => {
      const response = await fetch("/api/enterprise/lana-ai/delegates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: nextIds })
      });
      const data = await response.json();
      if (!data.success) { setDelegatesMessage(data.message || "Failed to update delegates"); return; }
      setNewDelegateUserId("");
      loadDelegates();
      setDelegatesMessage("تم تحديث قائمة المفوضين / Delegates updated");
    });
  }

  function removeDelegate(userId: string) {
    const nextIds = delegateEmployees.map((e) => e.userId).filter((id) => id !== userId);
    startTransition(async () => {
      const response = await fetch("/api/enterprise/lana-ai/delegates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: nextIds })
      });
      const data = await response.json();
      if (!data.success) { setDelegatesMessage(data.message || "Failed to update delegates"); return; }
      loadDelegates();
      setDelegatesMessage("تم تحديث قائمة المفوضين / Delegates updated");
    });
  }

  useEffect(() => {
    fetch("/api/enterprise/permissions", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load permissions");
        setPayload(data);
        const firstUserId = data.employees?.find((employee: EmployeeOption) => employee.userId)?.userId ?? "";
        setSelectedUserId(firstUserId);
        setCopySourceUserId(firstUserId);
        setSelectedPermissions(new Set(data.userPermissions?.[firstUserId]?.grants ?? []));
      })
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!payload || !selectedUserId) return;
    setSelectedPermissions(new Set(payload.userPermissions[selectedUserId]?.grants ?? []));
  }, [payload, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) { setFieldAccess({}); return; }
    fetch(`/api/enterprise/employee-field-access?userId=${encodeURIComponent(selectedUserId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (data.success) setFieldAccess(data.access ?? {}); })
      .catch(() => {});
  }, [selectedUserId]);

  function setFieldLevel(field: (typeof SENSITIVE_FIELDS)[number], level: FieldAccessLevel) {
    setFieldAccess((current) => ({ ...current, [field]: level }));
  }

  function saveFieldAccess() {
    if (!selectedUserId) return;
    startTransition(async () => {
      const response = await fetch("/api/enterprise/employee-field-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedUserId, access: fieldAccess })
      });
      const data = await response.json();
      if (!data.success) { setFieldAccessMessage(data.message || "Failed to update field access"); return; }
      setFieldAccess(data.access ?? {});
      setFieldAccessMessage("تم حفظ صلاحيات الحقول بنجاح / Field access saved");
    });
  }

  const selectedEmployee = useMemo(() => selectedEmployeeInfo || payload?.employees?.find((employee) => employee.userId === selectedUserId) || null, [payload, selectedUserId, selectedEmployeeInfo]);

  function viewAs() {
    if (!selectedUserId) return;
    setPreviewLoading(true);
    setPreview(null);
    fetch(`/api/enterprise/permissions/preview?userId=${encodeURIComponent(selectedUserId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) { setMessage(data.message || "Failed to load preview"); return; }
        setPreview(data);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setPreviewLoading(false));
  }

  function togglePermission(permission: string) {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  function save(operation: "replace" | "grant-all" | "remove-all" | "template" | "copy" | "reset-default") {
    if (!selectedUserId) return;
    startTransition(async () => {
      const response = await fetch("/api/enterprise/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUserId,
          grants: Array.from(selectedPermissions),
          operation,
          template,
          sourceUserId: copySourceUserId
        })
      });
      const data = await response.json();
      if (!data.success) {
        setMessage(data.message || "Failed to update permissions");
        return;
      }
      setPayload((current) => current ? {
        ...current,
        userPermissions: {
          ...current.userPermissions,
          [selectedUserId]: data.permissions
        }
      } : current);
      setSelectedPermissions(new Set(data.permissions.grants ?? []));
      setMessage("تم تحديث الصلاحيات بنجاح / Permissions updated successfully");
    });
  }

  if (!payload) {
    return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">جاري تحميل إدارة الصلاحيات...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Permissions Management</CardTitle>
          <CardDescription>Role and direct permissions are managed separately. Only Super Admin can change direct grants.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <label className="text-sm font-medium">اختيار الموظف / Select employee</label>
            <UserSearchSelect
              value={selectedUserId}
              onChange={(userId, label, employee) => {
                setSelectedUserId(userId);
                if (employee) setSelectedEmployeeInfo(employee);
              }}
              placeholder="ابحث برقم الهوية أو الاسم أو الرقم الوظيفي..."
            />
            {selectedEmployee ? (
              <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedEmployee.firstName} {selectedEmployee.lastName} ({selectedEmployee.employeeNumber || selectedEmployee.nationalId})</span>
                <span className="block mt-1">{selectedEmployee.department?.name ?? "بدون قسم / No department"} • {selectedEmployee.branch?.name ?? "بدون فرع / No branch"} • {selectedEmployee.user?.email ?? selectedEmployee.email ?? "بدون بريد"}</span>
              </div>
            ) : null}
            <Button type="button" variant="outline" onClick={viewAs} disabled={!selectedUserId || previewLoading}>
              <Eye className="me-2 h-4 w-4" />
              {previewLoading ? "جارٍ التحميل... / Loading..." : "مشاهدة كـ / View As"}
            </Button>
          </div>
          <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Selected direct grants: {selectedPermissions.size}</div>
            <div className="text-muted-foreground">Role permissions remain intact and are not removed by this screen.</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Actions</CardTitle>
          <CardDescription>Grant all, remove all, copy permissions, reset defaults, or apply a predefined template.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => save("replace")} disabled={isPending}>Save</Button>
          <Button type="button" variant="outline" onClick={() => save("grant-all")} disabled={isPending}>Grant All</Button>
          <Button type="button" variant="outline" onClick={() => save("remove-all")} disabled={isPending}>Remove All</Button>
          <Button type="button" variant="outline" onClick={() => save("reset-default")} disabled={isPending}><RotateCcw className="me-2 h-4 w-4" />Reset Default</Button>
          <select value={template} onChange={(event) => setTemplate(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
            {Object.keys(payload.templates).map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={() => save("template")} disabled={isPending}>Apply Template</Button>
          <div className="w-64"><UserSearchSelect value={copySourceUserId} onChange={(userId) => setCopySourceUserId(userId)} placeholder="اختر الموظف المصدر للنسخ..." /></div>
          <Button type="button" variant="outline" onClick={() => save("copy")} disabled={isPending}><Copy className="me-2 h-4 w-4" />Copy Permissions</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> التحكم بالحقول الحساسة / Sensitive field control</CardTitle>
          <CardDescription>
            لكل حقل: عرض فقط، تعديل، أو إخفاء تماماً (حتى عن لانا AI) -- محقق من جهة الخادم وليس مجرد إخفاء في الواجهة.
            Per field: View only, Edit, or Hidden entirely (including from Lana AI) -- enforced server-side, not just hidden in the UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {SENSITIVE_FIELDS.map((field) => (
            <div key={field} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background p-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                {FIELD_LABELS[field]}
                <FieldHint text={FIELD_HINTS[field]} />
              </span>
              <div className="flex gap-1">
                {(["VIEW", "EDIT", "HIDDEN"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFieldLevel(field, level)}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                      (fieldAccess[field] ?? "EDIT") === level
                        ? level === "HIDDEN" ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" : "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "hover:bg-muted"
                    }`}
                  >
                    {level === "VIEW" ? "عرض" : level === "EDIT" ? "تعديل" : "إخفاء"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" onClick={saveFieldAccess} disabled={isPending || !selectedUserId} className="mt-2">حفظ صلاحيات الحقول</Button>
          {fieldAccessMessage ? <div className="text-sm text-muted-foreground">{fieldAccessMessage}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" /> مفوضو الوكيل التنفيذي (Lana Admin Agent Delegates)</CardTitle>
          <CardDescription>
            فقط من تضيفه هنا يظهر له تاج التنفيذ بجانب لانا AI ويمكنه إصدار أوامر تنفيذية (مثل تعيين مسؤول موافقات لمستشفى/فرع).
            Only people added here see the execution crown next to Lana AI and can issue executive commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {delegateEmployees.length ? delegateEmployees.map((employee) => (
              <Badge key={employee.userId} className="flex items-center gap-1.5 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300">
                <Crown className="h-3 w-3" />
                {employee.employeeNumber} - {employee.firstName} {employee.lastName}
                <button type="button" onClick={() => removeDelegate(employee.userId)} className="ms-1 hover:text-rose-600" aria-label="remove delegate">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )) : <span className="text-sm text-muted-foreground">لا يوجد مفوضون حالياً / No delegates yet</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-72"><UserSearchSelect value={newDelegateUserId} onChange={(userId) => setNewDelegateUserId(userId)} /></div>
            <Button type="button" onClick={addDelegate} disabled={isPending || !newDelegateUserId}>إضافة مفوض</Button>
          </div>
          {delegatesMessage ? <div className="text-sm text-muted-foreground">{delegatesMessage}</div> : null}
        </CardContent>
      </Card>

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      {preview ? (
        <Card className="border-indigo-200 bg-indigo-50/40 dark:border-indigo-900 dark:bg-indigo-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                معاينة للقراءة فقط: {preview.employee?.name ?? "—"} / Read-only preview
              </CardTitle>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-lg p-1.5 hover:bg-background/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <CardDescription>
              هذا عرض للقراءة فقط لما سيراه هذا المستخدم بناءً على أدواره وصلاحياته المباشرة -- لا يتم فتح جلسة باسمه. This does not open a session as this user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">الأدوار / Roles:</span>
              {preview.roles.length ? preview.roles.map((role) => <Badge key={role}>{role}</Badge>) : <Badge variant="outline">NO_ROLE</Badge>}
              {preview.isSuperAdmin ? <Badge className="bg-amber-500 text-white">وصول كامل (Super Admin)</Badge> : null}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">الصفحات الظاهرة له / Visible modules ({preview.modules.filter((m) => m.visible).length}/{preview.modules.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.modules.map((module) => (
                  <Badge key={module.key} variant={module.visible ? "default" : "outline"} className={module.visible ? "" : "opacity-50 line-through"}>
                    {module.title}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {preview.categories.map((category) => (
                <div key={category.key} className="rounded-xl border bg-background p-3">
                  <p className="mb-2 text-sm font-semibold">{category.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.permissions.map((permission) => (
                      <Badge key={permission.key} variant={permission.granted ? "default" : "outline"} className={`font-mono text-[11px] ${permission.granted ? "" : "opacity-50 line-through"}`}>
                        {permission.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {payload.categories.map((category) => (
          <details key={category.key} open className="rounded-2xl border bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Users className="h-4 w-4" />{category.title}</summary>
            <div className="mt-4 grid gap-2">
              {category.permissions.map((permission) => (
                <label key={permission} className="flex items-center justify-between rounded-xl border bg-background p-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono">{permission}</span>
                    <PermissionHint permission={permission} />
                  </span>
                  <input type="checkbox" checked={selectedPermissions.has(permission)} onChange={() => togglePermission(permission)} className="h-5 w-5 accent-indigo-600" />
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
