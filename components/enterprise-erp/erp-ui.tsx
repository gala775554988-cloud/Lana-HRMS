import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { erpSuites, titleFromSlug } from "@/lib/enterprise-erp/catalog";
import { deleteErpRecord, saveErpRecord } from "@/lib/enterprise-erp/actions";

type Row = Record<string, unknown> & { id: string };

export function ErpHeader({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border bg-background p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Lana Enterprise ERP</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{description}</p></div>;
}

export function ErpNav() {
  return <div className="flex flex-wrap gap-2">{erpSuites.map((suite) => <Link key={suite.key} href={`/enterprise-erp/${suite.key}/${suite.features[0]}`} className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{suite.title}</Link>)}</div>;
}

export function ErpFeatureNav({ suite }: { suite: { key: string; features: readonly string[] } }) {
  return <div className="flex flex-wrap gap-2">{suite.features.map((feature) => <Link key={feature} href={`/enterprise-erp/${suite.key}/${feature}`} className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{titleFromSlug(feature)}</Link>)}</div>;
}

export function ErpForm({ suite, feature }: { suite: string; feature: string }) {
  return (
    <form action={saveErpRecord} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-6">
      <input type="hidden" name="suite" value={suite} />
      <input type="hidden" name="feature" value={feature} />
      <Input name="code" required aria-label="Code" />
      <Input name="name" required aria-label="Name" />
      <select name="status" className="h-10 rounded-md border bg-background px-3"><option>ACTIVE</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>CLOSED</option></select>
      <select name="priority" className="h-10 rounded-md border bg-background px-3"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select>
      <textarea name="payload" className="min-h-10 rounded-md border bg-background px-3 py-2" defaultValue='{"enabled":true}' />
      <textarea name="workflow" className="min-h-10 rounded-md border bg-background px-3 py-2" defaultValue='{"mode":"SEQUENTIAL","steps":[{"type":"approval","role":"MANAGER"}]}' />
      <Button type="submit">Save</Button>
    </form>
  );
}

export function ErpTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground"><tr>{["code", "name", "status", "priority", "payload", "workflow", "updatedAt", "actions"].map((key) => <th key={key} className="px-4 py-3 text-start font-medium">{key}</th>)}</tr></thead>
        <tbody className="divide-y">
          {rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr> : rows.map((row) => <tr key={row.id}><td className="px-4 py-3">{String(row.code)}</td><td className="px-4 py-3 font-medium">{String(row.name)}</td><td className="px-4 py-3">{String(row.status)}</td><td className="px-4 py-3">{String(row.priority)}</td><td className="max-w-sm truncate px-4 py-3">{JSON.stringify(row.payload)}</td><td className="max-w-sm truncate px-4 py-3">{JSON.stringify(row.workflow)}</td><td className="px-4 py-3">{row.updatedAt instanceof Date ? row.updatedAt.toLocaleString("ar-SA") : String(row.updatedAt)}</td><td className="px-4 py-3"><form action={deleteErpRecord}><input type="hidden" name="id" value={row.id} /><Button type="submit" variant="destructive" size="sm">Delete</Button></form></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
