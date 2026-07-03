import Link from "next/link";
import { notFound } from "next/navigation";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { ModuleForm } from "@/components/hrms/module-form";
import { ModuleTable } from "@/components/hrms/module-table";
import { FileUpload } from "@/components/hrms/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ResourcePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { module: resourceKey } = await params;
  const query = await searchParams;
  const resource = getHrmsModule(resourceKey);
  if (!resource) notFound();

  const filters = Object.fromEntries(resource.filterFields.map((field) => [field, typeof query[field] === "string" ? query[field] as string : undefined]));
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 10);
  const search = typeof query.search === "string" ? query.search : "";
  const data = await listModuleRecords({ resourceKey, page, pageSize, search, filters });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-sm font-medium text-muted-foreground">HRMS Module</p><h1 className="text-3xl font-semibold">{resource.title}</h1><p className="text-muted-foreground">{resource.description}</p></div>
        <Button asChild variant="outline"><Link href="/reports">Reports</Link></Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Search and filters</CardTitle><CardDescription>Find records by keyword and narrow the current view.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <input name="search" defaultValue={search} placeholder="Search" className="h-10 rounded-md border bg-background px-3 text-sm" />
            {resource.filterFields.map((field) => <input key={field} name={field} defaultValue={String(filters[field] ?? "")} placeholder={field} className="h-10 rounded-md border bg-background px-3 text-sm" />)}
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>
      {resource.key === "documents" || resource.key === "candidates" ? <FileUpload /> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <ModuleTable resource={resource} records={data.records as (Record<string, unknown> & { id: string })[]} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {data.page} of {data.pageCount} · {data.total} records</span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link href={"?page=" + Math.max(data.page - 1, 1) + "&search=" + encodeURIComponent(search)}>Previous</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href={"?page=" + Math.min(data.page + 1, data.pageCount) + "&search=" + encodeURIComponent(search)}>Next</Link></Button>
            </div>
          </div>
        </div>
        <Card><CardHeader><CardTitle>Create {resource.title}</CardTitle><CardDescription>Add a new record with validation and audit logging.</CardDescription></CardHeader><CardContent><ModuleForm resource={resource} /></CardContent></Card>
      </div>
    </section>
  );
}
