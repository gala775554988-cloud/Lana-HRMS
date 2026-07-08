import Link from "next/link";
import { enterpriseSuites } from "@/lib/enterprise-suite/catalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnterpriseSuiteIndex() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Lana HRMS Enterprise</p>
        <h1 className="text-3xl font-semibold tracking-tight">Enterprise Suites</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {enterpriseSuites.map((suite) => (
          <Card key={suite.key} className="h-full">
            <CardHeader><CardTitle>{suite.title}</CardTitle><CardDescription>{suite.features.length} enterprise capabilities</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {suite.features.map((feature) => <Link key={feature} className="rounded-full border px-3 py-1 text-sm hover:bg-accent" href={`/enterprise-suite/${suite.key}/${feature}`}>{feature}</Link>)}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
