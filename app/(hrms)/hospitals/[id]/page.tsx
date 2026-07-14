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
    hospital: hospital.name,
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
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">المستشفيات</p>
          <h1 className="text-3xl font-semibold tracking-tight">{hospital.name}</h1>
          <p className="mt-2 text-muted-foreground">الموظفون التابعون لهذه المستشفى فقط.</p>
        </div>
        <Button asChild variant="outline"><Link href="/branches?tab=hospitals">رجوع</Link></Button>
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
      />
    </section>
  );
}
