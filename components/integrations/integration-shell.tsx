import Link from "next/link";
import { integrationPages } from "@/lib/integrations/catalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function IntegrationShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">ERP Integrations</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {integrationPages.map((page) => (
          <Link key={page.href} href={page.href} className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {page.label}
          </Link>
        ))}
      </div>
      {children}
    </section>
  );
}

export function DataCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</CardHeader><CardContent>{children}</CardContent></Card>;
}

export function SimpleTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-muted-foreground"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-start font-medium">{column}</th>)}</tr></thead>
        <tbody className="divide-y">
          {rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr> : rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column} className="px-4 py-3 align-top">{formatValue(row[column])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 160);
  return String(value);
}
