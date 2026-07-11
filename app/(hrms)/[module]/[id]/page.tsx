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
import { Badge } from "@/components/ui/badge";
import { EmployeeProfileActions } from "@/components/hrms/employee-profile-actions";

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
  const [documents, contracts, attendance, leaveRequests, assets, performance, payrollItems, auditLogs] = await Promise.all([
    safeFindMany(client, "employeeDocument", { where: { employeeId: id }, take: 20, orderBy: { uploadedAt: "desc" } }),
    safeFindMany(client, "employeeContract", { where: { employeeId: id }, take: 20, orderBy: { createdAt: "desc" } }),
    safeFindMany(client, "attendanceRecord", { where: { employeeId: id }, take: 20, orderBy: { workDate: "desc" } }),
    safeFindMany(client, "leaveRequest", { where: { employeeId: id }, take: 20, orderBy: { createdAt: "desc" } }),
    safeFindMany(client, "asset", { where: { assignedEmployeeId: id }, take: 20, orderBy: { updatedAt: "desc" } }),
    safeFindMany(client, "performanceEvaluation", { where: { employeeId: id }, take: 20, orderBy: { updatedAt: "desc" } }),
    safeFindMany(client, "payrollItem", { where: { employeeId: id }, take: 20, orderBy: { createdAt: "desc" } }),
    safeFindMany(client, "auditLog", { where: { OR: [{ entityId: id }, { entity: "employee" }] }, take: 20, orderBy: { createdAt: "desc" } })
  ]);
  return { documents, contracts, attendance, leaveRequests, assets, performance, payrollItems, auditLogs };
}

const employeeTabs = [
  { id: "personal", label: "الشخصية" },
  { id: "job", label: "الوظيفة" },
  { id: "payroll", label: "الرواتب" },
  { id: "attendance", label: "الحضور" },
  { id: "leave", label: "الإجازات" },
  { id: "documents", label: "المستندات" },
  { id: "contracts", label: "العقود" },
  { id: "performance", label: "الأداء" },
  { id: "assets", label: "الأصول" },
  { id: "permissions", label: "الصلاحيات" },
  { id: "activity", label: "النشاط" },
  { id: "ai", label: "AI" },
] as const;

function SimpleRows({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">لا توجد بيانات مسجلة.</p>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={String(row.id ?? index)} className="rounded-lg border p-3 text-sm">
          <div className="grid gap-2 md:grid-cols-3">
            {Object.entries(row).slice(0, 9).map(([key, value]) => (
              <div key={key}><span className="text-muted-foreground">{key}: </span><span>{display(value)}</span></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
  const requestedTab = typeof query.tab === "string" ? query.tab : "personal";
  const activeEmployeeTab = employeeTabs.some((tab) => tab.id === requestedTab) ? requestedTab : "personal";

  let related = null;
  let scopedEmployees = null as Awaited<ReturnType<typeof listModuleRecords>> | null;
  const scopedEmployeeResource = resource.key === "departments" || resource.key === "branches" ? getHrmsModule("employees") : undefined;
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

  if (resource.key === "departments" || resource.key === "branches") {
    if (scopedEmployeeResource) {
      const employeeFilters = {
        departmentId: resource.key === "departments" ? id : undefined,
        branchId: resource.key === "branches" ? id : undefined,
        status: typeof query.status === "string" ? query.status : undefined,
        branch: typeof query.branch === "string" ? query.branch : undefined,
        hospital: typeof query.hospital === "string" ? query.hospital : undefined,
        project: typeof query.project === "string" ? query.project : undefined,
        section: typeof query.section === "string" ? query.section : undefined,
        position: typeof query.position === "string" ? query.position : undefined,
        nationality: typeof query.nationality === "string" ? query.nationality : undefined,
        employmentType: typeof query.employmentType === "string" ? query.employmentType : undefined,
        manager: typeof query.manager === "string" ? query.manager : undefined,
        hireDate: typeof query.hireDate === "string" ? query.hireDate : undefined
      };
      scopedEmployees = await listModuleRecords({
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
    <Card id="edit">
      <CardHeader>
        <CardTitle>{rec.edit}</CardTitle>
        <CardDescription>{rec.editDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <ModuleForm resource={resource} dictionary={dictionary} initialValues={record} recordId={id} />
      </CardContent>
    </Card>
  );

  const employeeTabCard = resource.key === "employees" ? (
    <Card>
      <CardHeader>
        <CardTitle>{employeeTabs.find((tab) => tab.id === activeEmployeeTab)?.label ?? "ملف الموظف"}</CardTitle>
        <CardDescription>بيانات تفصيلية مرتبطة بملف الموظف الحالي.</CardDescription>
      </CardHeader>
      <CardContent>
        {activeEmployeeTab === "personal" ? detailsCard : null}
        {activeEmployeeTab === "job" ? <SimpleRows rows={[{ departmentId: record.departmentId, branchId: record.branchId, positionId: record.positionId, employmentTypeId: record.employmentTypeId, hireDate: record.hireDate, status: record.status }]} /> : null}
        {activeEmployeeTab === "payroll" ? <SimpleRows rows={related?.payrollItems ?? []} /> : null}
        {activeEmployeeTab === "attendance" ? <SimpleRows rows={related?.attendance ?? []} /> : null}
        {activeEmployeeTab === "leave" ? <SimpleRows rows={related?.leaveRequests ?? []} /> : null}
        {activeEmployeeTab === "documents" ? <SimpleRows rows={related?.documents ?? []} /> : null}
        {activeEmployeeTab === "contracts" ? <SimpleRows rows={related?.contracts ?? []} /> : null}
        {activeEmployeeTab === "performance" ? <SimpleRows rows={related?.performance ?? []} /> : null}
        {activeEmployeeTab === "assets" ? <SimpleRows rows={related?.assets ?? []} /> : null}
        {activeEmployeeTab === "permissions" ? <div className="space-y-3"><p className="text-sm text-muted-foreground">إدارة صلاحيات الموظف المباشرة والفعالة.</p><Button asChild><Link href={`/permissions-management?userId=${String(record.userId ?? "")}`}>فتح صفحة الصلاحيات</Link></Button></div> : null}
        {activeEmployeeTab === "activity" ? <SimpleRows rows={related?.auditLogs ?? []} /> : null}
        {activeEmployeeTab === "ai" ? <div className="space-y-3"><Badge variant="outline">AI</Badge><p className="text-sm text-muted-foreground">تحليل مبدئي: راجع اكتمال بيانات الموظف والمستندات والعقود والحضور من التبويبات السابقة.</p><Button asChild variant="outline"><Link href="/lana-ai">فتح Lana AI</Link></Button></div> : null}
      </CardContent>
    </Card>
  ) : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{resourceTitle}</p>
          <h1 className="text-3xl font-semibold">{rec.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {resource.key === "employees" ? (
            <EmployeeProfileActions
              employeeId={id}
              userId={typeof record.userId === "string" ? record.userId : null}
              isArchived={Boolean(record.archivedAt)}
              pdfHref={`/api/hr/employees/export?format=pdf&search=${encodeURIComponent(String(record.employeeNumber ?? ""))}`}
              editHref={`/${resource.key}/${id}/edit`}
            />
          ) : null}
          <Button asChild variant="outline">
            <Link href={"/" + resource.key}>{rec.back}</Link>
          </Button>
        </div>
      </div>

      {resource.key === "employees" ? (
        <div className="overflow-x-auto rounded-2xl border bg-card p-3 print:hidden">
          <nav className="flex min-w-max gap-2" aria-label="Employee profile tabs">
            {employeeTabs.map((tab) => (
              <Link key={tab.id} href={`/${resource.key}/${id}/${tab.id}`} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeEmployeeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      {resource.key === "employees" ? employeeTabCard : (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          {detailsCard}
          {editCard}
        </div>
      )}

      {resource.key === "employees" && activeEmployeeTab === "personal" ? editCard : null}

      {(resource.key === "departments" || resource.key === "branches") && scopedEmployees && scopedEmployeeResource ? (
        <EmployeeList
          resource={scopedEmployeeResource}
          records={scopedEmployees.records as any[]}
          totalCount={scopedEmployees.total}
          page={scopedEmployees.page}
          pageCount={scopedEmployees.pageCount}
          search={typeof query.search === "string" ? query.search : ""}
          filters={{
            departmentId: resource.key === "departments" ? id : undefined,
            branchId: resource.key === "branches" ? id : undefined,
            status: typeof query.status === "string" ? query.status : undefined,
            branch: typeof query.branch === "string" ? query.branch : undefined,
            hospital: typeof query.hospital === "string" ? query.hospital : undefined,
            project: typeof query.project === "string" ? query.project : undefined,
            section: typeof query.section === "string" ? query.section : undefined,
            position: typeof query.position === "string" ? query.position : undefined,
            nationality: typeof query.nationality === "string" ? query.nationality : undefined,
            employmentType: typeof query.employmentType === "string" ? query.employmentType : undefined,
            manager: typeof query.manager === "string" ? query.manager : undefined,
            hireDate: typeof query.hireDate === "string" ? query.hireDate : undefined
          }}
          pageSize={scopedEmployees.pageSize}
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
