"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, HelpCircle, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PermissionManagementDashboard } from "@/components/enterprise/permission-management-dashboard";
import { UserSearchSelect } from "@/components/hrms/user-search-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
            aria-label="شرح الحقل"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onClick={(event) => event.stopPropagation()}
          className="z-[9999] w-64 p-3 shadow-2xl"
        >
          <span className="block text-slate-100 dark:text-slate-100 leading-relaxed">{text}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type PreviewData = {
  employee: { name: string; employeeNumber: string; department: string | null; branch: string | null } | null;
  roles: string[];
  isSuperAdmin: boolean;
  categories: Array<{ key: string; title: string; permissions: Array<{ key: string; granted: boolean }> }>;
  modules: Array<{ key: string; title: string; visible: boolean }>;
};

export function PermissionsManagementClient() {
  const [isPending, startTransition] = useTransition();

  // View As -- independent of the dashboard's active-list selection, since
  // it's a read-only preview for ANY employee, not tied to permission editing.
  const [viewAsUserId, setViewAsUserId] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");

  function viewAs() {
    if (!viewAsUserId) return;
    setPreviewLoading(true);
    setPreview(null);
    fetch(`/api/enterprise/permissions/preview?userId=${encodeURIComponent(viewAsUserId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) { setPreviewMessage(data.message || "Failed to load preview"); return; }
        setPreview(data);
      })
      .catch((error) => setPreviewMessage(error.message))
      .finally(() => setPreviewLoading(false));
  }

  // Sensitive field control -- also independent of the dashboard, since it
  // governs employee DATA field visibility, not RBAC permission grants.
  const [fieldUserId, setFieldUserId] = useState("");
  const [fieldAccess, setFieldAccess] = useState<FieldAccessMap>({});
  const [fieldAccessMessage, setFieldAccessMessage] = useState("");

  useEffect(() => {
    if (!fieldUserId) { setFieldAccess({}); return; }
    fetch(`/api/enterprise/employee-field-access?userId=${encodeURIComponent(fieldUserId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (data.success) setFieldAccess(data.access ?? {}); })
      .catch(() => {});
  }, [fieldUserId]);

  function setFieldLevel(field: (typeof SENSITIVE_FIELDS)[number], level: FieldAccessLevel) {
    setFieldAccess((current) => ({ ...current, [field]: level }));
  }

  function saveFieldAccess() {
    if (!fieldUserId) return;
    startTransition(async () => {
      const response = await fetch("/api/enterprise/employee-field-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: fieldUserId, access: fieldAccess })
      });
      const data = await response.json();
      if (!data.success) { setFieldAccessMessage(data.message || "Failed to update field access"); return; }
      setFieldAccess(data.access ?? {});
      setFieldAccessMessage("تم حفظ صلاحيات الحقول بنجاح / Field access saved");
    });
  }

  return (
    <div className="space-y-6">
      <PermissionManagementDashboard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> مشاهدة كـ / View As</CardTitle>
          <CardDescription>معاينة للقراءة فقط لما سيراه موظف معين بناءً على أدواره وصلاحياته -- لا يتم فتح جلسة باسمه.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-72"><UserSearchSelect value={viewAsUserId} onChange={(userId) => setViewAsUserId(userId)} /></div>
            <Button type="button" variant="outline" onClick={viewAs} disabled={!viewAsUserId || previewLoading}>
              <Eye className="me-2 h-4 w-4" />
              {previewLoading ? "جارٍ التحميل... / Loading..." : "مشاهدة / Preview"}
            </Button>
          </div>
          {previewMessage ? <div className="text-sm text-muted-foreground">{previewMessage}</div> : null}

          {preview ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{preview.employee?.name ?? "—"}</p>
                <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-lg p-1.5 hover:bg-background/60">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
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
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> التحكم بالحقول الحساسة / Sensitive field control</CardTitle>
          <CardDescription>
            لكل حقل: عرض فقط، تعديل، أو إخفاء تماماً (حتى عن لانا AI) -- محقق من جهة الخادم وليس مجرد إخفاء في الواجهة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-72"><UserSearchSelect value={fieldUserId} onChange={(userId) => setFieldUserId(userId)} /></div>
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
          <Button type="button" onClick={saveFieldAccess} disabled={isPending || !fieldUserId} className="mt-2">حفظ صلاحيات الحقول</Button>
          {fieldAccessMessage ? <div className="text-sm text-muted-foreground">{fieldAccessMessage}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
