import Link from "next/link";
import { notFound } from "next/navigation";
import { getHrmsModule } from "@/config/hrms";
import { getModuleRecord, listModuleRecords } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSalaryProfile, salaryProfileFields, salaryProfileLabels } from "@/lib/employee/salary-profile";
import { ModuleForm } from "@/components/hrms/module-form";
import { EmployeeList } from "@/components/hrms/employee-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
    } catch {
      return "-";
    }
  }
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

export default async function RecordPage({ params, searchParams }: { params: Promise<{ module: string; id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { module: resourceKey, id } = await params;
  const query = searchParams ? await searchParams : {};
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

  const { dictionary, locale } = await getRequestDictionary();
  const resourceTitle = resource.key in dictionary.nav ? dictionary.nav[resource.key as keyof typeof dictionary.nav] : resource.title;

  let related = null;
  let departmentEmployees = null as Awaited<ReturnType<typeof listModuleRecords>> | null;
  const departmentEmployeeResource = resource.key === "departments" ? getHrmsModule("employees") : undefined;
  let salaryProfile = null as Awaited<ReturnType<typeof getEmployeeSalaryProfile>> | null;
  if (resource.key === "employees") {
    try {
      related = await getEmployeeRelated(id);
      salaryProfile = await getEmployeeSalaryProfile(id);
      record = { ...record, ...salaryProfile };
    } catch (error) {
      console.error(`[RecordPage] getEmployeeRelated failed:`, error);
    }
  }

  if (resource.key === "departments") {
    if (departmentEmployeeResource) {
      const employeeFilters = {
        departmentId: id,
        status: typeof query.status === "string" ? query.status : undefined,
        branch: typeof query.branch === "string" ? query.branch : undefined,
        project: typeof query.project === "string" ? query.project : undefined,
        section: typeof query.section === "string" ? query.section : undefined,
        position: typeof query.position === "string" ? query.position : undefined,
        nationality: typeof query.nationality === "string" ? query.nationality : undefined,
        employmentType: typeof query.employmentType === "string" ? query.employmentType : undefined,
        manager: typeof query.manager === "string" ? query.manager : undefined,
        hireDate: typeof query.hireDate === "string" ? query.hireDate : undefined
      };
      departmentEmployees = await listModuleRecords({
        resourceKey: "employees",
        page: Number(query.page ?? 1),
        pageSize: Number(query.pageSize ?? 30),
        search: typeof query.search === "string" ? query.search : "",
        filters: employeeFilters
      });
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

  const detailsCard = (
    <Card>
      <CardHeader>
        <CardTitle>{rec.details}</CardTitle>
        <CardDescription>{rec.detailsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {resource.key === "employees" ? (
          <div className="rounded-md border p-3 sm:col-span-2">
            <p className="mb-2 text-xs uppercase text-muted-foreground">{(dictionary.fields as any)?.profilePhotoUrl ?? "الصورة الشخصية"}</p>
            {typeof record.profilePhotoUrl === "string" && record.profilePhotoUrl ? (
              <img src={record.profilePhotoUrl} alt="Employee photo" className="h-32 w-32 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-muted text-3xl text-muted-foreground">👤</div>
            )}
          </div>
        ) : null}
        {resource.key === "employees" ? (
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">{(dictionary.fields as any)?.fullName ?? "الاسم الكامل"}</p>
            <p className="break-words text-sm">{`${String(record.firstName ?? "")} ${String(record.lastName ?? "")}`.trim() || "-"}</p>
          </div>
        ) : null}
        {Object.entries(record).filter(([key]) => key !== "id" && key !== "profilePhotoUrl" && key !== "emergencyContact" && key !== "firstName" && key !== "lastName" && key !== "salaryCosts" && key !== "salaryDeductInsurance" && !(salaryProfileFields as readonly string[]).includes(key)).map(([key, value]) => {
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
  );

  const editCard = (
    <Card>
      <CardHeader>
        <CardTitle>{rec.edit}</CardTitle>
        <CardDescription>{rec.editDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <ModuleForm resource={resource} dictionary={dictionary} initialValues={record} recordId={id} />
      </CardContent>
    </Card>
  );

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
        {resource.key === "employees" ? editCard : detailsCard}
        {resource.key === "employees" ? detailsCard : editCard}
      </div>

      {resource.key === "departments" && departmentEmployees && departmentEmployeeResource ? (
        <EmployeeList
          resource={departmentEmployeeResource}
          records={departmentEmployees.records as any[]}
          totalCount={departmentEmployees.total}
          page={departmentEmployees.page}
          pageCount={departmentEmployees.pageCount}
          search={typeof query.search === "string" ? query.search : ""}
          filters={{
            departmentId: id,
            status: typeof query.status === "string" ? query.status : undefined,
            branch: typeof query.branch === "string" ? query.branch : undefined,
            project: typeof query.project === "string" ? query.project : undefined,
            section: typeof query.section === "string" ? query.section : undefined,
            position: typeof query.position === "string" ? query.position : undefined,
            nationality: typeof query.nationality === "string" ? query.nationality : undefined,
            employmentType: typeof query.employmentType === "string" ? query.employmentType : undefined,
            manager: typeof query.manager === "string" ? query.manager : undefined,
            hireDate: typeof query.hireDate === "string" ? query.hireDate : undefined
          }}
          pageSize={departmentEmployees.pageSize}
          dictionary={dictionary}
          locale={locale}
        />
      ) : null}

      {resource.key === "employees" ? (
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الراتب</CardTitle>
            <CardDescription>الراتب الأساسي والبدلات والخصومات وصافي الراتب.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">خصم التأمينات</p>
              <p className="text-lg font-semibold">{salaryProfile?.salaryDeductInsurance ? "مفعل" : "غير مفعل"}</p>
            </div>
            {(salaryProfile?.salaryCosts ?? []).map((cost, index) => (
              <div key={`cost-${index}`} className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">{index === 0 ? "التكلفة" : `التكلفة ${index + 1}`}</p>
                <p className="text-lg font-semibold">{display(cost)}</p>
              </div>
            ))}
            {salaryProfileFields.map((field) => (
              <div key={field} className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">{salaryProfileLabels[field]}</p>
                <p className="text-lg font-semibold">{display(salaryProfile?.[field])}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
