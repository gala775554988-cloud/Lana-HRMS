import Link from "next/link";
import { listModuleRecords } from "@/lib/hrms/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MyTeamPage() {
  const data = await listModuleRecords({ resourceKey: "employees", page: 1, pageSize: 100 });
  const employees = data.records as Array<{ id: string; employeeNumber?: string; firstName?: string; lastName?: string; department?: { name?: string }; branch?: { name?: string }; status?: string }>;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Supervisor</p>
        <h1 className="text-3xl font-semibold tracking-tight">فريقي</h1>
        <p className="mt-2 text-muted-foreground">Employees visible within your hierarchy and permission scope only.</p>
      </div>
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
    </section>
  );
}
