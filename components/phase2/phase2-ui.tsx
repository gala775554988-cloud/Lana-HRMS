import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { phase2Suites, titleFromSlug } from "@/lib/phase2/catalog";
import { deletePhase2Record, savePhase2Record, type Phase2Record } from "@/lib/phase2/store";

export function Phase2Header({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border bg-background p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Phase 2 Enterprise Production Completion</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{description}</p></div>;
}

export function Phase2Nav() {
  return <div className="flex flex-wrap gap-2">{phase2Suites.map((suite) => <Link key={suite.key} href={`/phase2-production/${suite.key}/${suite.features[0]}`} className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{suite.title}</Link>)}</div>;
}

export function Phase2FeatureNav({ suite }: { suite: { key: string; features: readonly string[] } }) {
  return <div className="flex flex-wrap gap-2">{suite.features.map((feature) => <Link key={feature} href={`/phase2-production/${suite.key}/${feature}`} className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{titleFromSlug(feature)}</Link>)}</div>;
}

export function Phase2Form({ suite, feature }: { suite: string; feature: string }) {
  return (
    <form action={savePhase2Record} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-6">
      <input type="hidden" name="suite" value={suite} />
      <input type="hidden" name="feature" value={feature} />
      <Input name="code" required aria-label="Code" />
      <Input name="name" required aria-label="Name" />
      <select name="status" className="h-10 rounded-md border bg-background px-3"><option>ACTIVE</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>CLOSED</option></select>
      <textarea name="payload" className="min-h-10 rounded-md border bg-background px-3 py-2 md:col-span-2" defaultValue='{"enabled":true}' />
      <Button type="submit">Save</Button>
    </form>
  );
}

export function Phase2Table({ suite, feature, rows }: { suite: string; feature: string; rows: Phase2Record[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground"><tr>{["code", "name", "status", "payload", "updatedAt", "actions"].map((key) => <th key={key} className="px-4 py-3 text-start font-medium">{key}</th>)}</tr></thead>
        <tbody className="divide-y">
          {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr> : rows.map((row) => <tr key={row.id}><td className="px-4 py-3">{row.code}</td><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3">{row.status}</td><td className="max-w-md truncate px-4 py-3">{JSON.stringify(row.payload)}</td><td className="px-4 py-3">{new Date(row.updatedAt).toLocaleString("ar-SA")}</td><td className="px-4 py-3"><form action={deletePhase2Record}><input type="hidden" name="suite" value={suite} /><input type="hidden" name="feature" value={feature} /><input type="hidden" name="code" value={row.code} /><Button type="submit" variant="destructive" size="sm">Delete</Button></form></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
