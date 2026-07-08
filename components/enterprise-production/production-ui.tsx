import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productionAreas } from "@/lib/enterprise-production/catalog";
import { createProductionRecord, deleteProductionRecord } from "@/lib/enterprise-production/actions";

export function ProductionNav() {
  return <div className="flex flex-wrap gap-2">{productionAreas.map((area) => <Link key={area.key} href={`/enterprise-production/${area.key}`} className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{area.title}</Link>)}</div>;
}

export function ProductionHeader({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border bg-background p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Enterprise Production</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{description}</p></div>;
}

export function ProductionForm({ area, features }: { area: string; features: readonly string[] }) {
  return (
    <form action={createProductionRecord} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-6">
      <input type="hidden" name="area" value={area} />
      <select name="feature" className="h-10 rounded-md border bg-background px-3">{features.map((feature) => <option key={feature} value={feature}>{feature}</option>)}</select>
      <Input name="code" required aria-label="Code" />
      <Input name="name" required aria-label="Name" />
      <textarea name="config" className="min-h-10 rounded-md border bg-background px-3 py-2 md:col-span-2" defaultValue='{"enabled":true}' />
      <textarea name="filters" className="min-h-10 rounded-md border bg-background px-3 py-2" defaultValue="{}" />
      <Button type="submit">Save</Button>
    </form>
  );
}

export function ProductionTable({ area, rows }: { area: string; rows: Array<Record<string, unknown> & { id: string }> }) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)).filter((key) => !['id'].includes(key)))).slice(0, 8);
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground"><tr>{keys.map((key) => <th key={key} className="px-4 py-3 text-start font-medium">{key}</th>)}<th className="px-4 py-3 text-start font-medium">actions</th></tr></thead>
        <tbody className="divide-y">
          {rows.length === 0 ? <tr><td colSpan={keys.length + 1} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr> : rows.map((row) => <tr key={row.id}>{keys.map((key) => <td key={key} className="max-w-xs truncate px-4 py-3 align-top">{formatValue(row[key])}</td>)}<td className="px-4 py-3"><form action={deleteProductionRecord}><input type="hidden" name="area" value={area} /><input type="hidden" name="id" value={row.id} /><Button type="submit" variant="destructive" size="sm">Delete</Button></form></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 180);
  return String(value);
}
