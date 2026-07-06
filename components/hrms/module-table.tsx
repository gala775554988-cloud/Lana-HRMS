"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition, useCallback } from "react";
import { Check, FileSearch, RotateCcw, X } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { HrmsModule } from "@/config/hrms";
import { deleteModuleRecord } from "@/lib/hrms/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/hrms/empty-state";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Row = Record<string, unknown> & { id: string };

function display(value: unknown, yesLabel: string, noLabel: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? yesLabel : noLabel;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatHeader(field: string, fieldsDict: Record<string, string>) {
  if (fieldsDict[field]) return fieldsDict[field];
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export function ModuleTable({ resource, records, dictionary, locale = "en" }: { resource: HrmsModule; records: Row[]; dictionary: Dictionary; locale?: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const helper = createColumnHelper<Row>();
  const fieldsDict = dictionary.fields as Record<string, string>;
  const yesLabel = dictionary.common?.yes ?? dictionary.module.yes ?? "Yes";
  const noLabel = dictionary.common?.no ?? dictionary.module.no ?? "No";

  const handleDelete = useCallback((id: string) => {
    startTransition(async () => {
      await deleteModuleRecord(resource.key, id);
      router.refresh();
    });
  }, [resource.key, router]);

  const handleDecision = useCallback((workflowId: string, decision: "APPROVE" | "REJECT" | "RETURN") => {
    startTransition(async () => {
      await fetch(`/api/enterprise/workflows/${workflowId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });
      router.refresh();
    });
  }, [router]);

  const columns = useMemo(() => [
    ...resource.tableFields.map((field) => helper.accessor((row) => row[field], { id: field, header: formatHeader(field, fieldsDict), cell: (info) => display(info.getValue(), yesLabel, noLabel) })),
    helper.display({ id: "actions", header: dictionary.table.actions, cell: ({ row }) => {
      const workflowId = typeof row.original._workflowId === "string" ? row.original._workflowId : "";
      const canAct = Boolean(row.original._canAct && workflowId);
      return (
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild size="sm" variant="outline"><Link href={"/" + resource.key + "/" + row.original.id}>{dictionary.table.open}</Link></Button>
          {canAct ? (
            <>
              <Button size="sm" disabled={isPending} onClick={() => handleDecision(workflowId, "APPROVE")}><Check className="me-1 h-3.5 w-3.5" />Approve</Button>
              <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleDecision(workflowId, "REJECT")}><X className="me-1 h-3.5 w-3.5" />Reject</Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleDecision(workflowId, "RETURN")}><RotateCcw className="me-1 h-3.5 w-3.5" />Return</Button>
            </>
          ) : null}
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleDelete(row.original.id)}>{dictionary.table.delete}</Button>
        </div>
      );
    }})
  ], [dictionary, fieldsDict, helper, isPending, noLabel, resource, yesLabel, handleDelete, handleDecision]);

  const table = useReactTable({ data: records, columns, getCoreRowModel: getCoreRowModel() });

  if (!records.length) {
    return <EmptyState icon={FileSearch} title={dictionary.table.noRecords} description={dictionary.table.noRecordsDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
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
