import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ModuleForm } from "@/components/hrms/module-form";
import { LoanForm } from "@/components/hrms/loan-form";
import { ModuleFormDialog } from "@/components/hrms/module-form-dialog";
import { ModuleTable } from "@/components/hrms/module-table";
import { EmployeeList } from "@/components/hrms/employee-list";
import { LeaveRequestsTable } from "@/components/hrms/leave-requests-table";
import { DepartmentSelector } from "@/components/hrms/department-selector";
import { BranchSelector } from "@/components/hrms/branch-selector";
import { FileUpload } from "@/components/hrms/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getEmployeeExtraSettings } from "@/lib/enterprise/hospitals";
import { AlertTriangle, BarChart3, Download, MoreHorizontal, Search, SlidersHorizontal, Upload } from "lucide-react";
import Link from "next/link";
import { ModuleTabs } from "@/components/hrms/module-tabs";

async function getBranchOptions(query: Record<string, string | string[] | undefined>) {
  const search = typeof query.search === "string" ? query.search : "";
  const department = typeof query.department === "string" ? query.department : "";
  const hospital = typeof query.hospital === "string" ? query.hospital : "";
  const isActive = typeof query.isActive === "string" ? query.isActive : "";

  // The hospital filter used to require `extra` (from getEmployeeExtraSettings)
  // before the branch query could even be built, forcing a sequential
  // extra -> branches chain on every load of this page, hospital filter or
  // not. Applying it as an in-memory filter afterward instead (branches
  // already include their employees, so no extra query is needed either way)
  // lets extra and branches load in parallel unconditionally.
  const branchAnd: Record<string, unknown>[] = [];
  if (search) branchAnd.push({ OR: [{ name: { contains: search, mode: "insensitive" as const } }, { code: { contains: search, mode: "insensitive" as const } }, { city: { contains: search, mode: "insensitive" as const } }] });
  if (isActive) branchAnd.push({ isActive: isActive === "true" });
  if (department) branchAnd.push({ employees: { some: { department: { name: { contains: department, mode: "insensitive" as const } } } } });

  const [extra, branches] = await Promise.all([
    getEmployeeExtraSettings(),
    prisma.branch.findMany({
      where: branchAnd.length ? { AND: branchAnd } : {},
      include: { employees: { select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, department: { select: { name: true, code: true } } } } },
      orderBy: { name: "asc" }
    })
  ]);

  const hospitalByEmployeeId = new Map(extra.map((item) => [item.employeeId, String(item.value.hospital ?? "")]));
  const filteredBranches = hospital
    ? branches.filter((branch) => branch.employees.some((employee) => hospitalByEmployeeId.get(employee.id)?.toLowerCase().includes(hospital.toLowerCase())))
    : branches;

  return filteredBranches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    city: branch.city,
    country: branch.country,
    isActive: branch.isActive,
    employeeCount: branch.employees.length,
    searchText: [branch.name, branch.code, branch.city, branch.country, ...branch.employees.flatMap((employee) => [employee.firstName, employee.lastName, `${employee.firstName} ${employee.lastName}`, employee.employeeNumber, employee.nationalId, employee.department?.name, employee.department?.code, hospitalByEmployeeId.get(employee.id)])].filter(Boolean).join(" ")
  }));
}

/**
 * Shared body for every generic-catalog module page. Used both by the standalone
 * app/(hrms)/[module]/page.tsx route and (with showModuleTabs=false) embedded
 * inside the new merged tab pages, so the two never drift apart.
 */
function buildQueryString(query: Record<string, string | string[] | undefined>, overrides: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) params.set(key, value);
  return "?" + params.toString();
}

export async function ModulePageBody({
  resourceKey,
  query,
  showModuleTabs = true,
  tabValue
}: {
  resourceKey: string;
  query: Record<string, string | string[] | undefined>;
  showModuleTabs?: boolean;
  /** When this body is one of several embedded on a merged tab page, namespaces
   * its search/page/filter query params (e.g. "contracts__search") so sibling
   * tabs on the same page don't clobber each other's list state. */
  tabValue?: string;
}) {
  const resource = getHrmsModule(resourceKey);
  if (!resource) notFound();
  const paramKey = (name: string) => (tabValue ? `${tabValue}__${name}` : name);
  const getParam = (name: string) => query[paramKey(name)];
  const { dictionary, locale } = await getRequestDictionary();
  const resourceTitle = resource.key in dictionary.nav ? dictionary.nav[resource.key as keyof typeof dictionary.nav] : resource.title;
  const resourceDescription = (dictionary.moduleDescriptions as Record<string, string>)[resource.key] ?? resource.description;

  const filters = Object.fromEntries(resource.filterFields.map((field) => [field, typeof getParam(field) === "string" ? getParam(field) as string : undefined]));
  if (resourceKey === "employees") {
    ["department", "hospital", "branch", "project", "section", "position", "nationality", "employmentType", "manager", "hireDate"].forEach((field) => {
      if (typeof query[field] === "string") filters[field] = query[field] as string;
    });
    const tab = typeof query.tab === "string" ? query.tab : "all";
    if (tab === "active") {
      filters.status = "ACTIVE";
    }
  }
  const page = Number(getParam("page") ?? 1);
  const pageSize = Number(getParam("pageSize") ?? (resourceKey === "employees" ? 30 : 10));
  const search = typeof getParam("search") === "string" ? getParam("search") as string : "";

  // Only the department/branch reference-data lookups stay awaited here --
  // they gate the filter cards below, which are cheap and small regardless of
  // overall module data volume. The actual list query (and, for leave-requests,
  // its stats) moves into ModuleDataSection behind a Suspense boundary below,
  // so the header/toolbar/filter cards paint immediately instead of waiting on
  // a query whose cost scales with how much data this module holds.
  const [departmentOptions, departmentEmployeeOptions, branchOptions] = await Promise.all([
    resourceKey === "departments" || resourceKey === "branches"
      ? prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    resourceKey === "departments"
      ? prisma.employee.findMany({ select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, departmentId: true }, take: 10000 })
      : Promise.resolve([]),
    resourceKey === "branches"
      ? getBranchOptions(query)
      : Promise.resolve([])
  ]);

  const polishedResource = resourceKey === "departments" || resourceKey === "branches";
  const t = dictionary.module;
  const f = dictionary.fields as Record<string, string>;
  const getFieldLabel = (fieldName: string) => f[fieldName] ?? fieldName;

  if (resourceKey === "employees") {
    const data = await listModuleRecords({ resourceKey, page, pageSize, search, filters });
    if ("error" in data && data.error) {
      const errorMessage = data.error === "Forbidden"
        ? "ليس لديك صلاحية لعرض هذه الوحدة"
        : data.error === "Unauthorized"
        ? "يرجى تسجيل الدخول أولاً"
        : data.error === "TABLE_NOT_FOUND"
        ? "جدول البيانات غير موجود. يرجى تشغيل migration: npx prisma migrate deploy"
        : "حدث خطأ أثناء تحميل البيانات. يرجى المحاولة لاحقاً";
      return (
        <section className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
          {showModuleTabs ? <ModuleTabs module={resourceKey} /> : null}
          <div className="flex flex-col gap-4 rounded-2xl border bg-background p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Badge variant="outline">{t.moduleTag}</Badge>
              <h1 className="text-3xl font-semibold tracking-tight">{resourceTitle}</h1>
              <p className="max-w-2xl text-muted-foreground">{resourceDescription}</p>
            </div>
          </div>
          <div className="flex min-h-[40vh] items-center justify-center rounded-xl border bg-card p-8">
            <div className="text-center max-w-md">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{errorMessage}</h3>
              <p className="text-sm text-muted-foreground mb-4">الوحدة: {resourceTitle}</p>
              <Button asChild variant="outline">
                <a href={`/${resourceKey}`}>إعادة المحاولة</a>
              </Button>
            </div>
          </div>
        </section>
      );
    }
    return (
      <div className="space-y-6">
        {showModuleTabs ? <ModuleTabs module={resourceKey} /> : null}
        <EmployeeList
          resource={resource}
          records={data.records as any[]}
          totalCount={data.total}
          page={data.page}
          pageCount={data.pageCount}
          search={search}
          filters={filters}
          pageSize={pageSize}
          dictionary={dictionary}
          locale={locale}
        />
      </div>
    );
  }

  return (
    <section className="space-y-5" dir={locale === "ar" ? "rtl" : "ltr"}>
      {showModuleTabs ? <ModuleTabs module={resourceKey} /> : null}
      <div className={polishedResource ? "flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-sm shadow-slate-200/60 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/30" : "flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between"}>
        <div className="space-y-2">
          <Badge variant="outline">{t.moduleTag}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{resourceTitle}</h1>
          <p className="max-w-2xl text-muted-foreground">{resourceDescription}</p>
        </div>
        {resource.key !== "audit-logs" ? (
          <div className="shrink-0">
            <ModuleFormDialog triggerLabel={`${t.create} ${resourceTitle}`} title={`${t.create} ${resourceTitle}`} description={t.createDescription}>
              {resource.key === "loans" ? <LoanForm dictionary={dictionary} locale={locale} /> : <ModuleForm resource={resource} dictionary={dictionary} locale={locale} />}
            </ModuleFormDialog>
          </div>
        ) : null}
      </div>

      {/* Compact single-row toolbar: search + filters on one side, import/export/reports tucked into a menu */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <form className="flex flex-1 flex-wrap items-center gap-2">
          {tabValue ? <input type="hidden" name="tab" value={tabValue} /> : null}
          <label className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
            <input name={paramKey("search")} defaultValue={search} placeholder={t.searchPlaceholder} className="h-9 w-full rounded-md border bg-background px-3 ps-9 text-sm rtl:ps-3 rtl:pe-9" />
          </label>
          {resource.filterFields.slice(0, 2).map((field) => <input key={field} name={paramKey(field)} defaultValue={String(filters[field] ?? "")} placeholder={getFieldLabel(field)} className="h-9 w-36 rounded-md border bg-background px-3 text-sm" />)}
          <Button type="submit" size="sm" variant="secondary"><SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />{t.apply}</Button>
        </form>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="المزيد من الإجراءات"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>تصدير واستيراد</DropdownMenuLabel>
              <DropdownMenuItem asChild><Link href={`/api/hr/${resourceKey}/export?format=xlsx&search=${encodeURIComponent(search)}`} className="flex items-center gap-2"><Download className="h-4 w-4" />تصدير Excel</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href={`/api/hr/${resourceKey}/export?format=pdf&search=${encodeURIComponent(search)}`} className="flex items-center gap-2"><Download className="h-4 w-4" />تصدير PDF</Link></DropdownMenuItem>
              {showModuleTabs ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href={`/${resourceKey}/reports`} className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />{t.openReports}</Link></DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {resource.key !== "audit-logs" ? <ImportPopover resourceKey={resourceKey} fieldNames={resource.fields.map((field) => field.name).join(", ")} /> : null}
        </div>
      </div>

      {resource.key === "departments" ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>قائمة الإدارات</CardTitle>
            <CardDescription>اختر إدارة موجودة فعلياً لعرض موظفيها.</CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentSelector departments={departmentOptions} employees={departmentEmployeeOptions} />
          </CardContent>
        </Card>
      ) : null}
      {resource.key === "branches" ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>الفلاتر</CardTitle>
            <CardDescription>اختر فرعاً أو صفِّ الفروع حسب الإدارة والمستشفى والحالة.</CardDescription>
          </CardHeader>
          <CardContent>
            <BranchSelector branches={branchOptions} departments={departmentOptions} initialFilters={{ search, department: typeof query.department === "string" ? query.department : undefined, hospital: typeof query.hospital === "string" ? query.hospital : undefined, isActive: typeof query.isActive === "string" ? query.isActive : undefined }} />
          </CardContent>
        </Card>
      ) : null}
      {resource.key === "documents" || resource.key === "candidates" ? <FileUpload /> : null}

      <Suspense fallback={<ModuleDataSkeleton />}>
        <ModuleDataSection
          resourceKey={resourceKey}
          resource={resource}
          page={page}
          pageSize={pageSize}
          search={search}
          filters={filters}
          query={query}
          paramKey={paramKey}
          dictionary={dictionary}
          locale={locale}
          t={t}
          resourceTitle={resourceTitle}
        />
      </Suspense>
    </section>
  );
}

function ModuleDataSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-64 animate-pulse rounded-xl border bg-card" />
      <div className="h-10 animate-pulse rounded-lg border bg-card" />
    </div>
  );
}

/**
 * Streams in behind the Suspense boundary above -- this is the part of the
 * page whose cost scales with actual data volume (the list query, plus the
 * leave-requests stats counts), so it's kept separate from the header/toolbar/
 * filter cards, which render immediately regardless of how long this takes.
 */
async function ModuleDataSection({
  resourceKey,
  resource,
  page,
  pageSize,
  search,
  filters,
  query,
  paramKey,
  dictionary,
  locale,
  t,
  resourceTitle
}: {
  resourceKey: string;
  resource: NonNullable<ReturnType<typeof getHrmsModule>>;
  page: number;
  pageSize: number;
  search: string;
  filters: Record<string, string | undefined>;
  query: Record<string, string | string[] | undefined>;
  paramKey: (name: string) => string;
  dictionary: Awaited<ReturnType<typeof getRequestDictionary>>["dictionary"];
  locale: Awaited<ReturnType<typeof getRequestDictionary>>["locale"];
  t: Awaited<ReturnType<typeof getRequestDictionary>>["dictionary"]["module"];
  resourceTitle: string;
}) {
  const [data, leaveRequestStats] = await Promise.all([
    listModuleRecords({ resourceKey, page, pageSize, search, filters }),
    resourceKey === "leave-requests"
      ? (async () => {
          const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
          const [pending, todayApprovals, approved, rejected] = await Promise.all([
            prisma.leaveRequest.count({ where: { status: "PENDING" } }),
            prisma.leaveRequest.count({ where: { status: "APPROVED", decidedAt: { gte: todayStart } } }),
            prisma.leaveRequest.count({ where: { status: "APPROVED" } }),
            prisma.leaveRequest.count({ where: { status: "REJECTED" } })
          ]);
          return { pending, todayApprovals, approved, rejected };
        })()
      : Promise.resolve({ pending: 0, todayApprovals: 0, approved: 0, rejected: 0 })
  ]);

  if ("error" in data && data.error) {
    const errorMessage = data.error === "Forbidden"
      ? "ليس لديك صلاحية لعرض هذه الوحدة"
      : data.error === "Unauthorized"
      ? "يرجى تسجيل الدخول أولاً"
      : data.error === "TABLE_NOT_FOUND"
      ? "جدول البيانات غير موجود. يرجى تشغيل migration: npx prisma migrate deploy"
      : "حدث خطأ أثناء تحميل البيانات. يرجى المحاولة لاحقاً";

    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border bg-card p-8">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{errorMessage}</h3>
          <p className="text-sm text-muted-foreground mb-4">الوحدة: {resourceTitle}</p>
          <Button asChild variant="outline">
            <a href={`/${resourceKey}`}>إعادة المحاولة</a>
          </Button>
        </div>
      </div>
    );
  }

  if (resourceKey === "leave-requests") {
    return (
      <LeaveRequestsTable
        records={data.records as any[]}
        stats={leaveRequestStats}
        page={data.page}
        pageCount={data.pageCount}
        total={data.total}
        prevHref={buildQueryString(query, { [paramKey("page")]: String(Math.max(data.page - 1, 1)) })}
        nextHref={buildQueryString(query, { [paramKey("page")]: String(Math.min(data.page + 1, data.pageCount)) })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ModuleTable resource={resource} records={data.records as (Record<string, unknown> & { id: string })[]} dictionary={dictionary} locale={locale} />
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{t.page} {data.page} {t.of} {data.pageCount} - {data.total} {t.records}</span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link href={buildQueryString(query, { [paramKey("page")]: String(Math.max(data.page - 1, 1)) })}>{t.previous}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={buildQueryString(query, { [paramKey("page")]: String(Math.min(data.page + 1, data.pageCount)) })}>{t.next}</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ImportPopover({ resourceKey, fieldNames }: { resourceKey: string; fieldNames: string }) {
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden" aria-label="استيراد بيانات">
        <Upload className="h-4 w-4" />
      </summary>
      <div className="absolute end-0 z-50 mt-2 w-80 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md">
        <p className="mb-1 text-sm font-semibold">استيراد البيانات</p>
        <p className="mb-3 text-xs text-muted-foreground">ارفع ملف Excel أو CSV يحتوي على أعمدة مطابقة لحقول الوحدة: {fieldNames}</p>
        <form action={`/api/hr/${resourceKey}/import`} method="post" encType="multipart/form-data" className="flex flex-col gap-2">
          <input name="file" type="file" accept=".xlsx,.xls,.csv" required className="h-9 w-full rounded-md border bg-background px-2 py-1.5 text-xs" />
          <Button type="submit" size="sm"><Upload className="me-1.5 h-3.5 w-3.5" />استيراد</Button>
        </form>
      </div>
    </details>
  );
}
