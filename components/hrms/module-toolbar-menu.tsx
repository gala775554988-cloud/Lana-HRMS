"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Download, MoreHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExportDataModal } from "@/components/hrms/export-data-modal";

/**
 * Extracted from module-page-body.tsx as its own client component because
 * ExportDataModal needs real React state (field picker, drag reorder) that
 * a DropdownMenuItem can't hold directly -- Radix unmounts DropdownMenuContent
 * (and anything nested inside it) when the menu closes, which would destroy
 * the dialog's state the instant a user clicked the item that opens it. The
 * dialog and its trigger item both need to live under one client component
 * that itself never unmounts, with the actual <Dialog> rendered as a sibling
 * of <DropdownMenu>, not nested inside DropdownMenuContent.
 */
export function ModuleToolbarMenu({
  resourceKey,
  search,
  showModuleTabs,
  openReportsLabel,
  exportFields,
  showImport,
  importFieldNames,
}: {
  resourceKey: string;
  search: string;
  showModuleTabs: boolean;
  openReportsLabel: string;
  exportFields: { name: string; label: string }[];
  showImport: boolean;
  importFieldNames: string;
}) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="المزيد من الإجراءات"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>تصدير واستيراد</DropdownMenuLabel>
          <DropdownMenuItem asChild><Link href={`/api/hr/${resourceKey}/export?format=xlsx&search=${encodeURIComponent(search)}`} className="flex items-center gap-2"><Download className="h-4 w-4" />تصدير Excel</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`/api/hr/${resourceKey}/export?format=pdf&search=${encodeURIComponent(search)}`} className="flex items-center gap-2"><Download className="h-4 w-4" />تصدير PDF</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setExportOpen(true)} className="flex items-center gap-2"><Download className="h-4 w-4" />تصدير مخصص...</DropdownMenuItem>
          {showModuleTabs ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href={`/${resourceKey}/reports`} className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />{openReportsLabel}</Link></DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ExportDataModal open={exportOpen} onOpenChange={setExportOpen} resourceKey={resourceKey} fields={exportFields} search={search} />
      {showImport ? (
        <details className="relative">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden" aria-label="استيراد بيانات">
            <Upload className="h-4 w-4" />
          </summary>
          <div className="premium-pop-in absolute end-0 z-50 mt-2 w-80 rounded-2xl border border-border/70 bg-popover/95 p-4 text-popover-foreground shadow-premium-lg backdrop-blur-xl">
            <p className="mb-1 text-sm font-semibold">استيراد البيانات</p>
            <p className="mb-3 text-xs text-muted-foreground">ارفع ملف Excel أو CSV يحتوي على أعمدة مطابقة لحقول الوحدة: {importFieldNames}</p>
            <form action={`/api/hr/${resourceKey}/import`} method="post" encType="multipart/form-data" className="flex flex-col gap-2">
              <input name="file" type="file" accept=".xlsx,.xls,.csv" required className="h-9 w-full rounded-xl border bg-background px-2 py-1.5 text-xs" />
              <Button type="submit" size="sm"><Upload className="me-1.5 h-3.5 w-3.5" />استيراد</Button>
            </form>
          </div>
        </details>
      ) : null}
    </div>
  );
}
