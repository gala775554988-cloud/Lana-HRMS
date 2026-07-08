import { notFound } from "next/navigation";
import { getEnterpriseFeature } from "@/lib/enterprise-suite/catalog";
import { createEnterpriseRecord, listEnterpriseRecords, seedWorkflowTemplate } from "@/lib/enterprise-suite/actions";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnterpriseRecordTable } from "@/components/enterprise-suite/enterprise-record-table";

export default async function EnterpriseFeaturePage({ params, searchParams }: { params: Promise<{ suite: string; feature: string }>; searchParams: Promise<{ search?: string }> }) {
  const { suite, feature } = await params;
  const { search = "" } = await searchParams;
  const meta = getEnterpriseFeature(suite, feature);
  if (!meta) notFound();
  const [rows, workflows] = await Promise.all([
    listEnterpriseRecords(suite, feature, search),
    prisma.enterpriseWorkflowTemplate.findMany({ where: { suite, feature }, orderBy: { updatedAt: "desc" } }).catch(() => [])
  ]);
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">{meta.suite.title}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{meta.title}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Create / Update Record</CardTitle></CardHeader>
        <CardContent>
          <form action={createEnterpriseRecord} className="grid gap-3 md:grid-cols-6">
            <input type="hidden" name="suite" value={suite} />
            <input type="hidden" name="feature" value={feature} />
            <Input name="code" required aria-label="Code" />
            <Input name="title" required aria-label="Title" />
            <select name="status" className="h-10 rounded-md border bg-background px-3"><option>ACTIVE</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>CLOSED</option></select>
            <select name="priority" className="h-10 rounded-md border bg-background px-3"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select>
            <textarea name="data" className="min-h-10 rounded-md border bg-background px-3 py-2 md:col-span-2" defaultValue="{}" />
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form action={seedWorkflowTemplate}><input type="hidden" name="suite" value={suite} /><input type="hidden" name="feature" value={feature} /><Button type="submit" variant="outline">Activate Standard Workflow</Button></form>
          <div className="rounded-md border bg-muted/20 p-3 text-sm">{JSON.stringify(workflows.map((workflow) => ({ name: workflow.name, steps: workflow.steps, conditions: workflow.conditions, slaHours: workflow.slaHours, isActive: workflow.isActive })))}</div>
        </CardContent>
      </Card>
      <EnterpriseRecordTable rows={rows as unknown as Array<Record<string, unknown> & { id: string }>} />
    </section>
  );
}
