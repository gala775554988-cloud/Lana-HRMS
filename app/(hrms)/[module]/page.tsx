import { notFound } from "next/navigation";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { ModuleForm } from "@/components/hrms/module-form";
import { ModuleTable } from "@/components/hrms/module-table";
import { EmployeeList } from "@/components/hrms/employee-list";
import { FileUpload } from "@/components/hrms/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, Plus, Search, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function ResourcePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { module: resourceKey } = await params;
  const query = await searchParams;
  const resource = getHrmsModule(resourceKey);
  if (!resource) notFound();
  const { dictionary, locale } = await getRequestDictionary();
  const resourceTitle = resource.key in dictionary.nav ? dictionary.nav[resource.key as keyof typeof dictionary.nav] : resource.title;
  const resourceDescription = (dictionary.moduleDescriptions as Record<string, string>)[resource.key] ?? resource.description;

  const filters = Object.fromEntries(resource.filterFields.map((field) => [field, typeof query[field] === "string" ? query[field] as string : undefined]));
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? (resourceKey === "employees" ? 30 : 10));
  const search = typeof query.search === "string" ? query.search : "";
  const data = await listModuleRecords({ resourceKey, page, pageSize, search, filters });

  const t = dictionary.module;
  const f = dictionary.fields as Record<string, string>;
  const getFieldLabel = (fieldName: string) => f[fieldName] ?? fieldName;

  // If listModuleRecords returned an error, show a graceful message instead of crashing
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
            <Button variant="outline" onClick={() => typeof window !== "undefined" && window.location.reload()}>
              إعادة المحاولة
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (resourceKey === "employees") {
    return (
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
    );
  }

  return (
    <section className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 rounded-2xl border bg-background p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline">{t.moduleTag}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{resourceTitle}</h1>
          <p className="max-w-2xl text-muted-foreground">{resourceDescription}</p>
        </div>
        <Button asChild variant="outline"><Link href="/reports">{t.openReports}</Link></Button>
      </div>
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> {t.searchTitle}</CardTitle><CardDescription>{t.searchDescription}</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
              <input name="search" defaultValue={search} placeholder={t.searchPlaceholder} className="h-10 w-full rounded-md border bg-background px-3 ps-9 text-sm rtl:ps-3 rtl:pe-9" />
            </label>
            {resource.filterFields.slice(0, 2).map((field) => <input key={field} name={field} defaultValue={String(filters[field] ?? "")} placeholder={getFieldLabel(field)} className="h-10 rounded-md border bg-background px-3 text-sm" />)}
            <Button type="submit">{t.apply}</Button>
          </form>
        </CardContent>
      </Card>
      {resource.key === "documents" || resource.key === "candidates" ? <FileUpload /> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <ModuleTable resource={resource} records={data.records as (Record<string, unknown> & { id: string })[]} dictionary={dictionary} locale={locale} />
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{t.page} {data.page} {t.of} {data.pageCount} - {data.total} {t.records}</span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link href={"?page=" + Math.max(data.page - 1, 1) + "&search=" + encodeURIComponent(search)}>{t.previous}</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href={"?page=" + Math.min(data.page + 1, data.pageCount) + "&search=" + encodeURIComponent(search)}>{t.next}</Link></Button>
            </div>
          </div>
        </div>
        <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{t.create} {resourceTitle}</CardTitle><CardDescription>{t.createDescription}</CardDescription></CardHeader><CardContent><ModuleForm resource={resource} dictionary={dictionary} locale={locale} /></CardContent></Card>
      </div>
    </section>
  );
}
