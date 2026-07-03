"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { FileSearch } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { HrmsModule } from "@/config/hrms";
import { deleteModuleRecord } from "@/lib/hrms/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/hrms/empty-state";

type Row = Record<string, unknown> & { id: string };

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ModuleTable({ resource, records }: { resource: HrmsModule; records: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const helper = createColumnHelper<Row>();
  const columns = useMemo(() => [
    ...resource.tableFields.map((field) => helper.accessor((row) => row[field], { id: field, header: field.replace(/([A-Z])/g, " $1"), cell: (info) => display(info.getValue()) })),
    helper.display({ id: "actions", header: "Actions", cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <Button asChild size="sm" variant="outline"><Link href={"/" + resource.key + "/" + row.original.id}>Open</Link></Button>
        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => startTransition(async () => { await deleteModuleRecord(resource.key, row.original.id); router.refresh(); })}>Delete</Button>
      </div>
    )})
  ], [helper, isPending, resource, router]);
  const table = useReactTable({ data: records, columns, getCoreRowModel: getCoreRowModel() });

  if (!records.length) {
    return <EmptyState icon={FileSearch} title="No records found" description="Create the first record or adjust your search and filters to widen the result set." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/70">
            {table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="px-4 py-3 text-start font-semibold text-muted-foreground">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => <tr key={row.id} className="border-t transition-colors hover:bg-muted/40">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3 align-top">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}