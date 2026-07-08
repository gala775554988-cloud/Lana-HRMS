import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { infraAreas, titleFromSlug } from "@/lib/infra/catalog";
import { deleteInfraRecord, saveInfraRecord } from "@/lib/infra/actions";

type Row = Record<string, unknown> & { id: string };

export function InfraHeader({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border bg-background p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Phase 4 Enterprise Infrastructure</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{description}</p></div>;
}

export function InfraNav() {
  return <div className="flex flex-wrap gap-2">{infraAreas.map((area) => <Link key={area.key} href={`/infra/${area.key}/${area.features[0]}`} className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{area.title}</Link>)}</div>;
}

export function InfraFeatureNav({ area }: { area: { key: string; features: readonly string[] } }) {
  return <div className="flex flex-wrap gap-2">{area.features.map((feature) => <Link key={feature} href={`/infra/${area.key}/${feature}`} className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{titleFromSlug(feature)}</Link>)}</div>;
}

export function InfraForm({ area, feature }: { area: string; feature: string }) {
  return (
    <form action={saveInfraRecord} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-5">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="feature" value={feature} />
      <Input name="code" required aria-label="Code" />
      <Input name="name" required aria-label="Name" />
      <textarea name="payload" className="min-h-10 rounded-md border bg-background px-3 py-2 md:col-span-2" defaultValue='{"enabled":true}' />
      <Button type="submit">Save</Button>
    </form>
  );
}

export function InfraTable({ area, feature, rows }: { area: string; feature: string; rows: Row[] }) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)).filter((key) => key !== "id"))).slice(0, 9);
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr>{keys.map((key) => <th key={key} className="px-4 py-3 text-start font-medium">{key}</th>)}<th className="px-4 py-3 text-start font-medium">actions</th></tr></thead><tbody className="divide-y">{rows.length === 0 ? <tr><td colSpan={keys.length + 1} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr> : rows.map((row) => <tr key={row.id}>{keys.map((key) => <td key={key} className="max-w-xs truncate px-4 py-3 align-top">{format(row[key])}</td>)}<td className="px-4 py-3"><form action={deleteInfraRecord}><input type="hidden" name="area" value={area} /><input type="hidden" name="feature" value={feature} /><input type="hidden" name="id" value={row.id} /><Button type="submit" variant="destructive" size="sm">Delete</Button></form></td></tr>)}</tbody></table>
    </div>
  );
}

function format(value: unknown) {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 180);
  return String(value);
}
