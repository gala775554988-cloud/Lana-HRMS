import Link from "next/link";
import { hrmsModules } from "@/config/hrms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <section className="space-y-6">
      <div><p className="text-sm font-medium text-muted-foreground">Analytics</p><h1 className="text-3xl font-semibold">Reports</h1><p className="text-muted-foreground">Operational report entry points for every HRMS domain.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hrmsModules.filter((entity) => entity.key !== "audit-logs").map((entity) => <Link key={entity.key} href={"/" + entity.key}><Card className="h-full transition-colors hover:bg-accent"><CardHeader><CardTitle>{entity.title}</CardTitle><CardDescription>{entity.description}</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Open live table, filters, and exports-ready data.</p></CardContent></Card></Link>)}
      </div>
    </section>
  );
}
