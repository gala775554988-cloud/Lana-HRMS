import Link from "next/link";
import { notFound } from "next/navigation";
import { getHrmsModule } from "@/config/hrms";
import { getModuleRecord } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ModuleForm } from "@/components/hrms/module-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type RelatedDelegate = { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };

async function safeFindMany(
  client: Record<string, RelatedDelegate>,
  model: string,
  args: Record<string, unknown>
) {
  try {
    return await (client[model]?.findMany?.(args) ?? Promise.resolve([]));
  } catch {
    return [];
  }
}

async function getEmployeeRelated(id: string) {
  const client = prisma as unknown as Record<string, RelatedDelegate>;
  const [documents, contracts, attendance, leaveRequests, assets] = await Promise.all([
    safeFindMany(client, "employeeDocument", { where: { employeeId: id }, take: 5, orderBy: { uploadedAt: "desc" } }),
    safeFindMany(client, "employeeContract", { where: { employeeId: id }, take: 5, orderBy: { createdAt: "desc" } }),
    safeFindMany(client, "attendanceRecord", { where: { employeeId: id }, take: 5, orderBy: { workDate: "desc" } }),
    safeFindMany(client, "leaveRequest", { where: { employeeId: id }, take: 5, orderBy: { createdAt: "desc" } }),
    safeFindMany(client, "asset", { where: { assignedEmployeeId: id }, take: 5, orderBy: { updatedAt: "desc" } })
  ]);
  return { documents, contracts, attendance, leaveRequests, assets };
}

export default async function RecordPage({ params }: { params: Promise<{ module: string; id: string }> }) {
  const { module: resourceKey, id } = await params;
  const resource = getHrmsModule(resourceKey);
  if (!resource) notFound();

  let record;
  try {
    record = await getModuleRecord(resourceKey, id);
  } catch (error) {
    console.error(`[RecordPage] getModuleRecord failed for ${resourceKey}/${id}:`, error);
    record = null;
  }

  if (!record) notFound();

  const { dictionary } = await getRequestDictionary();
  const resourceTitle = resource.key in dictionary.nav ? dictionary.nav[resource.key as keyof typeof dictionary.nav] : resource.title;

  let related = null;
  if (resource.key === "employees") {
    try {
      related = await getEmployeeRelated(id);
    } catch (error) {
      console.error(`[RecordPage] getEmployeeRelated failed:`, error);
    }
  }

  const rec = (dictionary as any).record || {
    title: "Record profile",
    details: "Details",
    detailsDesc: "Current values for this record.",
    edit: "Edit",
    editDesc: "Changes are validated and audited.",
    back: "Back",
    employeeProfile: "Employee profile",
    employeeProfileDesc: "Documents, contracts, attendance, leave, and assigned assets.",
    recentRecords: "Recent records",
    noData: "No data"
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{resourceTitle}</p>
          <h1 className="text-3xl font-semibold">{rec.title}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href={"/" + resource.key}>{rec.back}</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>{rec.details}</CardTitle>
            <CardDescription>{rec.detailsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {Object.entries(record).map(([key, value]) => {
              const fieldLabel = (dictionary.fields as any)?.[key] ?? key;
              return (
                <div key={key} className="rounded-md border p-3">
                  <p className="text-xs uppercase text-muted-foreground">{fieldLabel}</p>
                  <p className="break-words text-sm">{display(value)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{rec.edit}</CardTitle>
            <CardDescription>{rec.editDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <ModuleForm resource={resource} dictionary={dictionary} initialValues={record} recordId={id} />
          </CardContent>
        </Card>
      </div>

      {related ? (
        <Card>
          <CardHeader>
            <CardTitle>{rec.employeeProfile}</CardTitle>
            <CardDescription>{rec.employeeProfileDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Object.entries(related).map(([key, rows]) => (
              <div key={key} className="rounded-md border p-3">
                <p className="font-medium capitalize">{key}</p>
                <p className="text-2xl font-semibold">{rows.length}</p>
                <p className="text-sm text-muted-foreground">{rec.recentRecords}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
