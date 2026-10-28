"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  MoreHorizontal,
  Printer,
  Search,
  ShieldCheck,
  Upload,
  User,
  Wallet,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export type ProfileActivity = {
  id?: string;
  createdAt?: string | Date;
  title: string;
  description: string;
  tone?: string;
  actorName?: string | null;
};
const dateLabel = (
  value: string | Date | null | undefined,
  locale = "ar-SA",
) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat(
        locale === "ar-SA" ? "ar-SA-u-ca-gregory" : locale,
        { day: "numeric", month: "short", year: "numeric" },
      ).format(new Date(value))
    : "غير مسجل";

export function ProfileHero({
  employee,
  yearsOfService,
  isAr,
  canEdit,
  canManageAccounts,
  onSelect,
  onArchive,
  onResetPassword,
  onUnbind,
}: {
  employee: any;
  yearsOfService: string;
  isAr: boolean;
  canEdit: boolean;
  canManageAccounts: boolean;
  onSelect: (tab: string) => void;
  onArchive: () => void;
  onResetPassword: () => void;
  onUnbind: () => void;
}) {
  const name = `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();
  const status: Record<string, string> = {
    ACTIVE: "على رأس العمل",
    ON_LEAVE: "في إجازة",
    INACTIVE: "غير نشط",
    TERMINATED: "منتهية الخدمة",
  };
  const locale = isAr ? "ar-SA" : "en-US";
  return (
    <section
      className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm dark:border-slate-800"
      aria-label="ملخص ملف الموظف"
    >
      <div className="relative overflow-hidden lana-contrast-banner bg-slate-950 px-5 pb-14 pt-6 text-white sm:px-8">
        <div className="pointer-events-none absolute -end-12 -top-28 h-80 w-80 rounded-full border-[45px] border-white/[0.025]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 text-xs text-blue-100">
          <Link
            href="/employees"
            className="flex items-center gap-2 hover:text-white"
          >
            <User className="h-4 w-4" />
            دليل الموظفين<span>/</span>الملف الوظيفي
          </Link>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            مساحة الموظف
          </span>
        </div>
        <div className="relative mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl border-4 border-white/15 bg-white/10 shadow-xl">
            {employee.profilePhotoUrl ? <AvatarImage src={employee.profilePhotoUrl} alt={name} className="object-cover" /> : null}
            <AvatarFallback className="rounded-none bg-transparent text-3xl font-semibold text-white">{employee.firstName?.[0]}{employee.lastName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium">
                رقم الموظف · {employee.employeeNumber}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${employee.status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-300"}`}
                />
                {status[employee.status] ?? employee.status}
              </span>
            </div>
            <h1 className="max-w-4xl text-2xl font-bold leading-relaxed tracking-tight sm:text-3xl">
              {name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-blue-100">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                {employee.position?.title || "المسمى الوظيفي غير مسجل"}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {employee.department?.name || "الإدارة غير مسجلة"}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {employee.branch?.name || "الموقع غير مسجل"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="relative mx-5 -mt-6 grid grid-cols-2 divide-x divide-x-reverse overflow-hidden rounded-2xl border bg-card shadow-sm sm:mx-8 lg:grid-cols-4">
        {[
          {
            icon: CalendarDays,
            label: "تاريخ الانضمام",
            value: dateLabel(employee.hireDate, locale),
          },
          { icon: Clock3, label: "مدة الخدمة", value: yearsOfService },
          {
            icon: User,
            label: "المدير المباشر",
            value: employee.manager
              ? `${employee.manager.firstName} ${employee.manager.lastName}`
              : "غير مسجل",
          },
          {
            icon: ShieldCheck,
            label: "آخر دخول",
            value: dateLabel(employee.user?.lastLoginAt, locale),
          },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0 p-4 sm:p-5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </p>
            <p className="break-words text-xs font-semibold leading-6 sm:text-sm">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <p className="text-xs text-muted-foreground">
          كل ما يتعلق بالموظف، من مكان واحد.
        </p>
        <div className="flex flex-wrap gap-2">
          {canManageAccounts ? (
            <Button
              onClick={() => onSelect("account")}
              className="gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <KeyRound className="h-4 w-4" />
              الحساب ورموز التفعيل
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href={`/employees/${employee.id}/edit`}>تعديل الملف</Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
          {canEdit || canManageAccounts ? (
            <details className="relative">
              <summary
                aria-label="إجراءات إضافية"
                className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border hover:bg-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute end-0 top-12 z-30 w-56 rounded-2xl border bg-card p-2 shadow-xl">
                {canManageAccounts ? (
                  <>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs"
                      onClick={onResetPassword}
                    >
                      إعادة تعيين كلمة المرور
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs"
                      onClick={onUnbind}
                    >
                      تنظيف ارتباطات الأجهزة السابقة
                    </Button>
                  </>
                ) : null}
                {canEdit ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-xs text-rose-600"
                    onClick={onArchive}
                  >
                    {["INACTIVE", "TERMINATED"].includes(employee.status)
                      ? "استعادة الموظف من الأرشيف"
                      : "أرشفة الموظف"}
                  </Button>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProfileActivityFeed({
  entries,
  compact = false,
}: {
  entries: ProfileActivity[];
  compact?: boolean;
}) {
  const visible = compact ? entries.slice(0, 3) : entries;
  return (
    <div className="space-y-1">
      {visible.length ? (
        visible.map((entry, index) => (
          <article key={entry.id ?? index} className="relative flex gap-4 py-4">
            <div
              className={`relative mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${entry.tone === "security" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"}`}
            >
              {entry.tone === "security" ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{entry.title}</h3>
                <time className="text-[11px] text-muted-foreground">
                  {dateLabel(entry.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                {entry.description}
              </p>
              {entry.actorName ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  بواسطة {entry.actorName}
                </p>
              ) : null}
            </div>
          </article>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <Clock3 className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">لا توجد أحداث مسجلة بعد</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ستظهر هنا تحديثات الملف والحساب عند حدوثها.
          </p>
        </div>
      )}
    </div>
  );
}

export function ProfileOverview({
  employee,
  documents,
  contracts,
  payrollItems,
  activity,
  canManageAccounts,
  onSelect,
}: {
  employee: any;
  documents: any[];
  contracts: any[];
  payrollItems: any[];
  activity: ProfileActivity[];
  canManageAccounts: boolean;
  onSelect: (tab: string) => void;
}) {
  const shortcuts = [
    {
      tab: "documents",
      title: "المستندات والمرفقات",
      subtitle: "استعرض وارفع ملفات الموظف",
      icon: FolderOpen,
      value: `${documents.length} مستند معروض`,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
    },
    {
      tab: "salary",
      title: "الرواتب والمستحقات",
      subtitle: "الراتب والبدلات وكشوف الصرف",
      icon: Wallet,
      value: `${payrollItems.length} كشوف حديثة`,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      tab: "contracts",
      title: "العقود الوظيفية",
      subtitle: "العقود والمرفقات وتواريخ السريان",
      icon: Briefcase,
      value: `${contracts.length} عقود معروضة`,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {shortcuts.map(({ tab, title, subtitle, icon: Icon, value, color }) => (
          <button
            key={tab}
            onClick={() => onSelect(tab)}
            className="group rounded-2xl border bg-card p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="flex items-center justify-between">
              <span
                className={`grid h-11 w-11 place-items-center rounded-2xl ${color}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <ArrowUpLeft className="h-4 w-4 text-muted-foreground transition group-hover:text-indigo-600" />
            </div>
            <h2 className="mt-5 text-sm font-bold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            <p className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
              {value}
            </p>
          </button>
        ))}
      </div>
      {canManageAccounts ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-indigo-950">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold">أين أجد رمز تفعيل الموظف؟</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                من تبويب الحساب والتفعيل، اختر إصدار رمز تفعيل وسلّمه للموظف بعد
                التحقق من هويته.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="shrink-0 gap-2 rounded-xl bg-card"
            onClick={() => onSelect("account")}
          >
            فتح الحساب والتفعيل
            <ArrowUpLeft className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <User className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold">معلومات سريعة</h2>
          </div>
          {[
            { label: "البريد الإلكتروني", value: employee.email, icon: Mail },
            {
              label: "الموقع / الفرع",
              value: employee.branch?.name,
              icon: MapPin,
            },
            {
              label: "الإدارة",
              value: employee.department?.name,
              icon: Building2,
            },
            {
              label: "نوع التوظيف",
              value: employee.employmentType?.name,
              icon: Briefcase,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex gap-3 border-b py-3 last:border-0">
              <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="mt-1 break-words text-xs font-medium leading-6">
                  {value || "غير مسجل"}
                </p>
              </div>
            </div>
          ))}
          <button
            className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
            onClick={() => onSelect("personal")}
          >
            عرض البيانات الشخصية كاملة ←
          </button>
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">آخر التحديثات</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onSelect("activity")}
            >
              عرض السجل
            </Button>
          </div>
          <ProfileActivityFeed entries={activity} compact />
        </section>
      </div>
    </div>
  );
}

export function EmployeeDocumentLibrary({
  files,
  total,
  search,
  onSearch,
  onView,
  onDownload,
  onDelete,
  onUpload,
  onDrop,
  onSync,
  onFolder,
  uploading,
  syncing,
  canSync,
  canEdit,
}: {
  files: any[];
  total: number;
  search: string;
  onSearch: (value: string) => void;
  onView: (file: any) => void;
  onDownload: (file: any) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
  onDrop: (files: FileList) => void;
  onSync: () => void;
  onFolder: () => void;
  uploading: boolean;
  syncing: boolean;
  canSync: boolean;
  canEdit: boolean;
}) {
  const [kind, setKind] = useState("all");
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("newest");
  const fileKind = (file: any) =>
    /\.(png|jpe?g|webp|gif)$/i.test(file.fileName || file.name || "") ||
    file.mimeType?.startsWith("image/")
      ? "images"
      : /\.pdf$/i.test(file.fileName || file.name || "") ||
          file.mimeType === "application/pdf"
        ? "pdf"
        : "other";
  const visible = useMemo(
    () =>
      files
        .filter((file) => kind === "all" || fileKind(file) === kind)
        .slice()
        .sort((a, b) =>
          sort === "name"
            ? String(a.name ?? a.fileName ?? "").localeCompare(
                String(b.name ?? b.fileName ?? ""),
                "ar",
              )
            : new Date(b.uploadedAt || 0).getTime() -
              new Date(a.uploadedAt || 0).getTime(),
        ),
    [files, kind, sort],
  );
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="space-y-5 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold">مكتبة المستندات والمرفقات</h2>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              الملفات الوظيفية والمرفقات في مساحة منظمة وسهلة البحث.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={onFolder}
              >
                مجلد جديد
              </Button>
              <Button
                className="gap-2 rounded-xl"
                onClick={onUpload}
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "جارٍ الرفع…" : "رفع مستندات"}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="البحث في المستندات"
              placeholder="ابحث باسم الملف أو نوع المستند…"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              className="rounded-xl ps-10"
            />
          </div>
          <select
            aria-label="ترتيب المستندات"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-xl border bg-background px-3 py-2 text-xs"
          >
            <option value="newest">الأحدث أولاً</option>
            <option value="name">حسب الاسم</option>
          </select>
          <div className="flex rounded-xl border p-1">
            <Button
              aria-label="عرض بطاقات المستندات"
              aria-pressed={view === "grid"}
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              aria-label="عرض قائمة المستندات"
              aria-pressed={view === "list"}
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "كل الملفات"],
            ["pdf", "ملفات PDF"],
            ["images", "الصور"],
            ["other", "ملفات أخرى"],
          ].map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={kind === value ? "default" : "ghost"}
              className="rounded-full text-xs"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </Button>
          ))}
          {canEdit && canSync ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={syncing}
              onClick={onSync}
              className="ms-auto gap-2 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "جارٍ المزامنة…" : "مزامنة مرفقات Odoo"}
            </Button>
          ) : null}
        </div>
      </header>
      <div className="p-5 sm:p-6">
        {canEdit ? (
          <button
            type="button"
            disabled={uploading}
            onClick={onUpload}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!uploading) onDrop(event.dataTransfer.files);
            }}
            className="mb-6 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 p-5 text-center transition hover:bg-indigo-50/70 dark:border-indigo-900 dark:bg-indigo-950/10 sm:flex-row"
          >
            <Upload className="h-6 w-6 text-indigo-500" />
            <span>
              <span className="block text-xs font-semibold">
                اسحب ملفاتك هنا أو اضغط لاختيار المستندات
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                PDF، صور، مستندات Office وملفات أخرى
              </span>
            </span>
          </button>
        ) : null}
        <p className="mb-4 text-[11px] text-muted-foreground">
          {visible.length} مستند مطابق
        </p>
        <div
          className={
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "space-y-3"
          }
        >
          {visible.map((file) => {
            const category = fileKind(file);
            const available = Boolean(file.fileUrl || file.attachmentUrl);
            return (
              <article
                key={file.id}
                className={`group rounded-2xl border bg-background/40 p-4 transition hover:border-indigo-200 hover:shadow-sm ${view === "list" ? "flex flex-wrap items-center gap-4" : ""}`}
              >
                <div
                  className={`flex items-center justify-between ${view === "list" ? "" : "mb-4"}`}
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl ${category === "pdf" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30" : category === "images" ? "bg-violet-50 text-violet-600 dark:bg-violet-950/30" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30"}`}
                  >
                    {category === "images" ? (
                      <FileImage className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </span>
                  {view === "grid" ? (
                    <Badge variant="outline" className="text-[10px]">
                      {category === "pdf"
                        ? "PDF"
                        : category === "images"
                          ? "صورة"
                          : "مستند"}
                    </Badge>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-semibold leading-6">
                    {file.name || file.fileName || "مستند بدون عنوان"}
                  </h3>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {file.fileName || ""}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {dateLabel(file.uploadedAt)}
                    {file.sizeBytes
                      ? ` · ${(Number(file.sizeBytes) / 1024).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} ك.ب`
                      : ""}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1 ${view === "grid" ? "mt-4 border-t pt-3" : ""}`}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!available}
                    onClick={() => onView(file)}
                    className="gap-1.5 text-xs"
                    aria-label={`معاينة ${file.name || file.fileName || "المستند"}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    معاينة
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!available}
                    onClick={() => onDownload(file)}
                    aria-label={`تنزيل ${file.name || file.fileName || "المستند"}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ms-auto text-rose-600"
                      onClick={() => onDelete(file.id)}
                      aria-label={`حذف ${file.name || file.fileName || "المستند"}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        {!visible.length ? (
          <div className="py-12 text-center">
            <FolderOpen className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-sm font-semibold">
              {total
                ? "لا توجد ملفات تطابق البحث"
                : "مكتبة الموظف جاهزة لاستقبال المستندات"}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {total
                ? "جرّب تغيير كلمة البحث أو نوع الملف."
                : "ستجد هنا كل ملفات الموظف ومرفقاته بعد إضافتها."}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
