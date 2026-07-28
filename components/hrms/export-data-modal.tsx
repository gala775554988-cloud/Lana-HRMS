"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Plus, Trash2, Search, GripVertical, FileSpreadsheet, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ExportField = { name: string; label: string };

/**
 * Field-picker export dialog: lets the user choose exactly which columns to
 * export and in what order, instead of the plain "Export Excel"/"Export PDF"
 * links (module-page-body.tsx) which always dump every configured column.
 * Builds on the existing /api/hr/[module]/export route -- see the `fields`
 * query param it now reads -- rather than a separate export mechanism.
 *
 * Controlled (open/onOpenChange) rather than owning its own trigger+state:
 * its caller (module-toolbar-menu.tsx) opens it from a DropdownMenuItem, and
 * Radix unmounts DropdownMenuContent -- and anything nested inside it -- the
 * instant the menu closes, which would destroy this dialog's state before it
 * ever rendered if the open state lived in here instead.
 */
export function ExportDataModal({
  open,
  onOpenChange,
  resourceKey,
  fields,
  search,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceKey: string;
  fields: ExportField[];
  search?: string;
}) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fieldsByName = useMemo(() => {
    const map: Record<string, ExportField> = {};
    fields.forEach((f) => (map[f.name] = f));
    return map;
  }, [fields]);

  const filteredAvailable = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return fields.filter((f) => {
      if (selected.includes(f.name)) return false;
      if (!term) return true;
      return f.label.toLowerCase().includes(term) || f.name.toLowerCase().includes(term);
    });
  }, [fields, searchTerm, selected]);

  const addField = useCallback((name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const removeField = useCallback((name: string) => {
    setSelected((prev) => prev.filter((f) => f !== name));
  }, []);

  const addAllFiltered = useCallback(() => {
    setSelected((prev) => {
      const toAdd = filteredAvailable.map((f) => f.name).filter((name) => !prev.includes(name));
      return [...prev, ...toAdd];
    });
  }, [filteredAvailable]);

  const handleDrop = (index: number) => {
    const from = dragIndex.current;
    if (from === null || from === index) {
      setDragOverIndex(null);
      return;
    }
    setSelected((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({ format });
    if (search) params.set("search", search);
    if (selected.length > 0) params.set("fields", selected.join(","));
    return `/api/hr/${resourceKey}/export?${params.toString()}`;
  }, [format, resourceKey, search, selected]);

  const handleExportClick = () => {
    window.location.href = exportUrl;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div dir="rtl" className="contents">
        <DialogHeader>
          <div>
            <DialogTitle>تصدير البيانات</DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">اختر الحقول وصيغة الملف لتصدير البيانات</p>
          </div>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>

          <div className="flex items-center gap-3 border-b pb-4">
            <div className="flex items-center rounded-lg border bg-background p-1 gap-1">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  format === "xlsx" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                XLSX
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  format === "csv" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </div>

          <div className="flex min-h-[320px] flex-1 gap-4 overflow-hidden py-2">
            <div className="flex w-1/2 flex-col border-e pe-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">الحقول المتاحة</span>
                <button
                  type="button"
                  onClick={addAllFiltered}
                  disabled={filteredAvailable.length === 0}
                  className="text-[11px] font-medium text-primary hover:text-primary/80 disabled:opacity-30"
                >
                  إضافة الكل
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث عن حقل..."
                  className="w-full rounded-lg border bg-background py-2 pe-3 ps-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto">
                {filteredAvailable.length === 0 && <p className="mt-8 text-center text-xs text-muted-foreground">لا توجد حقول مطابقة</p>}
                {filteredAvailable.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => addField(f.name)}
                    className="group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-start text-sm text-foreground/80 hover:bg-muted"
                  >
                    <span>{f.label}</span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex w-1/2 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  الحقول المراد تصديرها <span className="text-primary">({selected.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  disabled={selected.length === 0}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  إفراغ القائمة
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selected.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center">
                    <p className="text-xs text-muted-foreground">اختر حقولاً من القائمة اليمنى لإضافتها هنا، ويمكنك سحبها لإعادة ترتيبها</p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {selected.map((name, index) => {
                      const f = fieldsByName[name];
                      if (!f) return null;
                      const isDragOver = dragOverIndex === index;
                      return (
                        <li
                          key={name}
                          draggable
                          onDragStart={() => { dragIndex.current = index; }}
                          onDragOver={(e) => { e.preventDefault(); if (dragOverIndex !== index) setDragOverIndex(index); }}
                          onDrop={() => handleDrop(index)}
                          onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null); }}
                          className={`flex cursor-grab items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors active:cursor-grabbing ${
                            isDragOver ? "border-primary/50 bg-primary/5" : "border-transparent bg-muted/60 hover:border-border"
                          }`}
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background text-[10px] text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="flex-1 truncate text-foreground/90">{f.label}</span>
                          <button type="button" onClick={() => removeField(name)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`إزالة ${f.label}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {selected.length > 0 ? `سيتم تصدير ${selected.length} حقل بصيغة ${format.toUpperCase()}` : "سيتم تصدير كل الحقول (لم يتم تخصيص أي حقل)"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>إغلاق</Button>
              <Button size="sm" onClick={handleExportClick}>
                <Download className="me-1.5 h-3.5 w-3.5" />
                تصدير
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
