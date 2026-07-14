import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { EmployeeList } from "@/components/hrms/employee-list";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Users, UsersRound } from "lucide-react";

const OrganizationHierarchyClient = dynamicImport(() => import("@/components/enterprise/organization-hierarchy-client").then((mod) => mod.OrganizationHierarchyClient));

export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

type Query = Record<string, string | string[] | undefined>;

const getCachedEmployeeTotal = unstable_cache(
  async () => prisma.employee.count({ where: { status: { not: "INACTIVE" } } }).catch(() => 0),
  ["employees-active-total-count-v1"],
  { revalidate: 60 }
);

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(one(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildFastEmployeeWhere(query: Query) {
  const search = one(query.search)?.trim() ?? "";
  const tab = one(query.tab) ?? "all";
  const filters = {
    department: one(query.department)?.trim(),
    hospital: one(query.hospital)?.trim(),
    branch: one(query.branch)?.trim(),
    project: one(query.project)?.trim(),
    section: one(query.section)?.trim(),
    position: one(query.position)?.trim(),
    nationality: one(query.nationality)?.trim(),
    employmentType: one(query.employmentType)?.trim(),
    hireDate: one(query.hireDate)?.trim(),
    status: one(query.status)?.trim(),
  };

  const and: Record<string, unknown>[] = [];
  if (search) {
    and.push({
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { employeeNumber: { contains: search, mode: "insensitive" } },
        { nationalId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (tab === "active") and.push({ status: "ACTIVE" });
  else if (filters.status) and.push({ status: filters.status });
  else and.push({ status: { not: "INACTIVE" } });

  if (filters.department) and.push({ department: { name: { contains: filters.department, mode: "insensitive" } } });
  if (filters.branch) and.push({ branch: { name: { contains: filters.branch, mode: "insensitive" } } });
  if (filters.position || filters.section) and.push({ position: { title: { contains: filters.position || filters.section, mode: "insensitive" } } });
  if (filters.nationality) and.push({ nationality: { name: { contains: filters.nationality, mode: "insensitive" } } });
  if (filters.employmentType) and.push({ employmentType: { name: { contains: filters.employmentType, mode: "insensitive" } } });
  if (filters.hireDate) {
    const start = new Date(filters.hireDate);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      and.push({ hireDate: { gte: start, lt: end } });
    }
  }

  return {
    where: and.length ? { AND: and } : {},
    search,
    filters,
    hasExpensiveFilter: Boolean(filters.hospital || filters.project),
    hasAnyFilter: Boolean(search || tab === "active" || Object.values(filters).some(Boolean)),
  };
}

function serializeEmployee(row: any) {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    nationalId: row.nationalId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    profilePhotoUrl: row.profilePhotoUrl,
    status: row.status,
    hireDate: row.hireDate ? row.hireDate.toISOString().slice(0, 10) : null,
    department: row.department,
    position: row.position,
    branch: row.branch,
    employmentType: row.employmentType,
    lastLoginAt: row.user?.lastLoginAt ? row.user.lastLoginAt.toLocaleString("ar-SA") : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

async function getFastEmployees(query: Query) {
  const page = positiveNumber(query.page, 1);
  const pageSize = Math.min(Math.max(positiveNumber(query.pageSize, 24), 12), 50);
  const built = buildFastEmployeeWhere(query);

  const records = await prisma.employee.findMany({
    where: built.where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      employeeNumber: true,
      nationalId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      profilePhotoUrl: true,
      status: true,
      hireDate: true,
      createdAt: true,
      department: { select: { name: true, code: true } },
      position: { select: { title: true } },
      branch: { select: { name: true } },
      employmentType: { select: { name: true } },
      user: { select: { lastLoginAt: true } },
    },
  });

  const total = built.hasAnyFilter || page > 1
    ? await prisma.employee.count({ where: built.where }).catch(() => records.length)
    : await getCachedEmployeeTotal();

  return {
    records: records.map(serializeEmployee),
    total,
    page,
    pageSize,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
    search: built.search,
    filters: built.filters,
    shouldFallback: built.hasExpensiveFilter,
  };
}

async function MyTeamTab() {
  const data = await listModuleRecords({ resourceKey: "employees", page: 1, pageSize: 100 });
  const employees = data.records as Array<{ id: string; employeeNumber?: string; firstName?: string; lastName?: string; department?: { name?: string }; branch?: { name?: string }; status?: string }>;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {employees.length === 0 ? <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground md:col-span-2 xl:col-span-3">No team members found.</div> : null}
      {employees.map((employee) => (
        <Link key={employee.id} href={`/employees/${employee.id}`}>
          <Card className="h-full transition hover:bg-muted/40">
            <CardHeader><CardTitle className="text-base">{employee.employeeNumber} - {employee.firstName} {employee.lastName}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{employee.department?.name ?? "No department"} • {employee.branch?.name ?? "No branch"} • {employee.status}</CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resource = getHrmsModule("employees");
  if (!resource) throw new Error("Employees module is not configured");
  const { dictionary, locale } = await getRequestDictionary();
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const canUseFastPath = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const activeTab = one(query.tab) ?? "directory";

  let directoryContent: React.ReactNode = null;
  if (activeTab === "directory") {
    if (!canUseFastPath) {
      const page = positiveNumber(query.page, 1);
      const pageSize = Math.min(Math.max(positiveNumber(query.pageSize, 24), 12), 50);
      const search = one(query.search) ?? "";
      const filters = Object.fromEntries(["department", "hospital", "branch", "project", "section", "position", "nationality", "employmentType", "manager", "hireDate", "status"].map((field) => [field, one(query[field])])) as Record<string, string | undefined>;
      const data = await listModuleRecords({ resourceKey: "employees", page, pageSize, search, filters });
      directoryContent = <EmployeeList resource={resource} records={data.records as any[]} totalCount={data.total} page={data.page} pageCount={data.pageCount} search={search} filters={filters} pageSize={pageSize} dictionary={dictionary} locale={locale} />;
    } else {
      const data = await getFastEmployees(query);
      if (data.shouldFallback) {
        const dataFallback = await listModuleRecords({ resourceKey: "employees", page: data.page, pageSize: data.pageSize, search: data.search, filters: data.filters });
        directoryContent = <EmployeeList resource={resource} records={dataFallback.records as any[]} totalCount={dataFallback.total} page={dataFallback.page} pageCount={dataFallback.pageCount} search={data.search} filters={data.filters} pageSize={data.pageSize} dictionary={dictionary} locale={locale} />;
      } else {
        directoryContent = <EmployeeList resource={resource} records={data.records as any[]} totalCount={data.total} page={data.page} pageCount={data.pageCount} search={data.search} filters={data.filters} pageSize={data.pageSize} dictionary={dictionary} locale={locale} />;
      }
    }
  }

  return (
    <div className="space-y-6">
      <MergedModuleTabs
        defaultValue="directory"
        items={[
          { value: "directory", label: "دليل الموظفين", icon: Users, content: directoryContent },
          {
            value: "hierarchy",
            label: "الهيكل التنظيمي",
            icon: Network,
            hidden: !isSuperAdmin,
            content: (
              <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading hierarchy...</div>}>
                <OrganizationHierarchyClient />
              </Suspense>
            )
          },
          {
            value: "my-team",
            label: "فريقي",
            icon: UsersRound,
            content: activeTab === "my-team" ? (
              <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جاري التحميل...</div>}>
                <MyTeamTab />
              </Suspense>
            ) : null
          }
        ]}
      />
    </div>
  );
}
