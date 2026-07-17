import { notFound } from "next/navigation";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { listHospitals } from "@/lib/enterprise/hospitals";
import { EmployeeList } from "@/components/hrms/employee-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function HospitalDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { dictionary, locale } = await getRequestDictionary();
  const employeeResource = getHrmsModule("employees");
  if (!employeeResource) notFound();

  const hospitals = await listHospitals();
  const hospital = hospitals.hospitals.find((item) => item.id === id);
  if (!hospital) notFound();

  const filters = {
    hospital: hospital.id,
    department: typeof query.department === "string" ? query.department : undefined,
    branch: typeof query.branch === "string" ? query.branch : undefined,
    project: typeof query.project === "string" ? query.project : undefined,
    section: typeof query.section === "string" ? query.section : undefined,
    position: typeof query.position === "string" ? query.position : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
    nationality: typeof query.nationality === "string" ? query.nationality : undefined,
    employmentType: typeof query.employmentType === "string" ? query.employmentType : undefined,
    manager: typeof query.manager === "string" ? query.manager : undefined,
    hireDate: typeof query.hireDate === "string" ? query.hireDate : undefined
  };

  const data = await listModuleRecords({
    resourceKey: "employees",
    page: Number(query.page ?? 1),
    pageSize: Number(query.pageSize ?? 30),
    search: typeof query.search === "string" ? query.search : "",
    filters
  });

  return (
    <section className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">المستشفيات والمواقع الطبية</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">{hospital.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">جدول الموظفين التابعين لهذا المستشفى حصراً ({data.total} موظف)</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl px-4 py-2"><Link href="/hospitals">← العودة إلى قائمة المستشفيات</Link></Button>
      </div>
      <EmployeeList
        resource={employeeResource}
        records={data.records as any[]}
        totalCount={data.total}
        page={data.page}
        pageCount={data.pageCount}
        search={typeof query.search === "string" ? query.search : ""}
        filters={filters}
        pageSize={data.pageSize}
        dictionary={dictionary}
        locale={locale}
        fromHref={`/hospitals/${id}`}
      />
    </section>
  );
}
