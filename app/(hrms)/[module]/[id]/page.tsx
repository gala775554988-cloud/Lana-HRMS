import Link from "next/link";
import { notFound } from "next/navigation";
import { getHrmsModule } from "@/config/hrms";
import { getModuleRecord } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ModuleForm } from "@/components/hrms/module-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type RelatedDelegate = { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };

async function getEmployeeRelated(id: string) {
  const client = prisma as unknown as Record<string, RelatedDelegate>;
  const [documents, contracts, attendance, leaveRequests, assets] = await Promise.all([
    client.employeeDocument.findMany({ where: { employeeId: id }, take: 5, orderBy: { uploadedAt: "desc" } }),
    client.employeeContract.findMany({ where: { employeeId: id }, take: 5, orderBy: { createdAt: "desc" } }),
    client.attendanceRecord.findMany({ where: { employeeId: id }, take: 5, orderBy: { workDate: "desc" } }),
    client.leaveRequest.findMany({ where: { employeeId: id }, take: 5, orderBy: { createdAt: "desc" } }),
    client.asset.findMany({ where: { assignedEmployeeId: id }, take: 5, orderBy: { updatedAt: "desc" } })
  ]);
  return { documents, contracts, attendance, leaveRequests, assets };
}

export default async function RecordPage({ params }: { params: Promise<{ module: string; id: string }> }) {
  const { module: resourceKey, id } = await params;
  const resource = getHrmsModule(resourceKey);
  if (!resource) notFound();
  const record = await getModuleRecord(resourceKey, id);
  if (!record) notFound();
  const { dictionary } = await getRequestDictionary();
  const resourceTitle = resource.key in dictionary.nav ? dictionary.nav[resource.key as keyof typeof dictionary.nav] : resource.title;
  const related = resource.key === "employees" ? await getEmployeeRelated(id) : null;
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">{resourceTitle}</p><h1 className="text-3xl font-semibold">Record profile</h1></div><Button asChild variant="outline"><Link href={"/" + resource.key}>Back</Link></Button></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card><CardHeader><CardTitle>Details</CardTitle><CardDescription>Current values for this record.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{Object.entries(record).map(([key, value]) => <div key={key} className="rounded-md border p-3"><p className="text-xs uppercase text-muted-foreground">{key}</p><p className="break-words text-sm">{display(value)}</p></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Edit</CardTitle><CardDescription>Changes are validated and audited.</CardDescription></CardHeader><CardContent><ModuleForm resource={resource} dictionary={dictionary} initialValues={record} recordId={id} /></CardContent></Card>
      </div>
      {related ? <Card><CardHeader><CardTitle>Employee profile</CardTitle><CardDescription>Documents, contracts, attendance, leave, and assigned assets.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{Object.entries(related).map(([key, rows]) => <div key={key} className="rounded-md border p-3"><p className="font-medium capitalize">{key}</p><p className="text-2xl font-semibold">{rows.length}</p><p className="text-sm text-muted-foreground">Recent records</p></div>)}</CardContent></Card> : null}
    </section>
  );
}
