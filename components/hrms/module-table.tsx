"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition, useCallback } from "react";
import { Check, ExternalLink, FileSearch, MoreVertical, RotateCcw, Trash2, X } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { HrmsModule } from "@/config/hrms";
import { deleteModuleRecord } from "@/lib/hrms/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/hrms/empty-state";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

const INSURANCE_EXPIRY_SCALE_DAYS = 60;

/** Renewal-status bar for the insurance module's endDate column: green when
 * comfortably far from renewal (>30 days), amber in the 10-30 day window,
 * red inside 10 days or already expired -- mirrors the sidebar's 30-day
 * "renewal due soon" badge threshold from use-expiring-insurance-count.ts. */
function InsuranceExpiryBar({ endDate }: { endDate: unknown }) {
  const parsed = typeof endDate === "string" || endDate instanceof Date ? new Date(endDate) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return <span>-</span>;

  const daysLeft = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const percent = Math.max(0, Math.min(100, (daysLeft / INSURANCE_EXPIRY_SCALE_DAYS) * 100));
  const tone = daysLeft < 0
    ? { bar: "bg-destructive", text: "text-destructive", label: "منتهية" }
    : daysLeft < 10
    ? { bar: "bg-destructive", text: "text-destructive", label: `${daysLeft} يوم متبقي` }
    : daysLeft <= 30
    ? { bar: "bg-warning", text: "text-warning-foreground", label: `${daysLeft} يوم متبقي` }
    : { bar: "bg-success", text: "text-emerald-700 dark:text-emerald-400", label: `${daysLeft} يوم متبقي` };

  return (
    <div className="min-w-[140px] space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
        <span className={cn("font-semibold", tone.text)}>{tone.label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500 ease-in-out", tone.bar)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function ModuleTable({ resource, records, dictionary, locale = "en", fromHref }: { resource: HrmsModule; records: Row[]; dictionary: Dictionary; locale?: Locale; fromHref?: string }) {
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
    ...resource.tableFields.map((field) => helper.accessor((row) => row[field], {
      id: field,
      header: formatHeader(field, fieldsDict),
      cell: (info) => resource.key === "insurance" && field === "endDate"
        ? <InsuranceExpiryBar endDate={info.getValue()} />
        : display(info.getValue(), yesLabel, noLabel)
    })),
    helper.display({ id: "actions", header: dictionary.table.actions, cell: ({ row }) => {
      const workflowId = typeof row.original._workflowId === "string" ? row.original._workflowId : "";
      const canAct = Boolean(row.original._canAct && workflowId);
      const baseOpenHref = "/" + resource.key + "/" + row.original.id;
      const openHref = resource.key === "departments"
        ? `/employees?department=${encodeURIComponent(String(row.original.name ?? ""))}`
        : (fromHref && resource.key === "employees" ? `${baseOpenHref}?from=${encodeURIComponent(fromHref)}` : baseOpenHref);
      const openLabel = resource.key === "departments" ? "عرض" : dictionary.table.open;
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          {canAct ? (
            <>
              <Button size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400" disabled={isPending} onClick={() => handleDecision(workflowId, "APPROVE")}><Check className="me-1 h-3.5 w-3.5" />Approve</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isPending} onClick={() => handleDecision(workflowId, "REJECT")}><X className="me-1 h-3.5 w-3.5" />Reject</Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleDecision(workflowId, "RETURN")}><RotateCcw className="me-1 h-3.5 w-3.5" />Return</Button>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={dictionary.table.actions}><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={openHref} className="flex items-center gap-2"><ExternalLink className="h-4 w-4" />{openLabel}</Link>
              </DropdownMenuItem>
              {resource.key !== "departments" && resource.key !== "audit-logs" ? (
                <DropdownMenuItem variant="destructive" disabled={isPending} onSelect={() => handleDelete(row.original.id)}>
                  <Trash2 className="h-4 w-4" />{dictionary.table.delete}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }})
  ], [dictionary, fieldsDict, helper, isPending, noLabel, resource, yesLabel, handleDelete, handleDecision]);

  const table = useReactTable({ data: records, columns, getCoreRowModel: getCoreRowModel() });
  const polished = resource.key === "departments" || resource.key === "branches";

  if (!records.length) {
    return <EmptyState icon={FileSearch} title={dictionary.table.noRecords} description={dictionary.table.noRecordsDescription} />;
  }

  return (
    <div className={cn("overflow-hidden border bg-background shadow-sm", polished ? "rounded-2xl border-slate-200/80 bg-white shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/30" : "rounded-lg")} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={polished ? "bg-indigo-50/70 text-indigo-950 dark:bg-indigo-950/20 dark:text-indigo-100" : "bg-muted/70"}>
            {table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="px-4 py-3 text-start font-semibold text-muted-foreground">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => <tr key={row.id} className={polished ? "border-t border-slate-100 transition-colors hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/20" : "border-t transition-colors hover:bg-muted/40"}>{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3 align-top">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
