"use client";

import React, { useState, useMemo } from "react";
import { Search, FileText, Eye, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

// Employee Portal is view-only for documents: employees never upload, replace,
// or delete their own official records (they're Odoo-sourced/HR-managed) --
// see app/api/employees/documents/route.ts, which now rejects POST/DELETE from
// callers without manage:documents. Upload/folder/delete UI removed here to
// match; HR/Admin retain full CRUD via components/hrms/employee-profile-dashboard.tsx.
export function EmployeeDocumentsPortal({ employeeId, initialDocuments }: { employeeId: string; initialDocuments: any[] }) {
  const [docs] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [activePreviewDoc, setActivePreviewDoc] = useState<any | null>(null);
  const filtered = useMemo(() => docs.filter((d) => !search || [d.name, d.fileName, d.type, d.status].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()))), [docs, search]);
  const previewUrl = activePreviewDoc ? (activePreviewDoc.fileUrl || activePreviewDoc.attachmentUrl) : null;

  return (
    <main className="space-y-6 font-sans" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">المستندات</h1>
        <p className="text-muted-foreground font-semibold">معاينة مستنداتك الرسمية المعتمدة من قبل الموارد البشرية.</p>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث سريع بالمستندات..." className="pr-10 h-11 rounded-xl font-bold" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs hover:border-primary/40 transition">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-sm text-slate-900 dark:text-slate-100">{doc.fileName || doc.name}</p>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {doc.type} · {doc.status}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActivePreviewDoc(doc)}
                className="rounded-xl h-8 px-3 font-extrabold text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                title="عرض المستند داخل النظام"
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>عرض</span>
              </Button>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-muted-foreground font-bold text-sm col-span-full">
            لا توجد مستندات مطابقة للبحث حتى الآن.
          </div>
        )}
      </div>

      {/* In-App Universal Document Preview Modal (عرض المستند داخل النظام بدون تعقيد) */}
      {activePreviewDoc ? (
        <Dialog open={true} onOpenChange={() => setActivePreviewDoc(null)}>
          <DialogContent className="max-w-4xl w-full h-[88vh] flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4" dir="rtl">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary font-bold">
                  📄
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                    معاينة المستند: {activePreviewDoc.fileName || activePreviewDoc.name}
                  </DialogTitle>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {activePreviewDoc.type} · {activePreviewDoc.status} · {(activePreviewDoc.sizeBytes ? (Number(activePreviewDoc.sizeBytes)/1024).toFixed(1)+'KB' : 'المستند المرفق')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 me-6">
                <button
                  onClick={() => setActivePreviewDoc(null)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </DialogHeader>

            {/* Document Viewer Frame */}
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-200/80 dark:border-slate-800 flex items-center justify-center p-3 mt-3">
              {!previewUrl ? (
                <div className="flex flex-col items-center gap-2 text-center px-6">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <p className="font-black text-slate-800 dark:text-slate-200">تعذّر فتح هذا المستند</p>
                  <p className="text-sm text-muted-foreground font-semibold">رابط المستند غير متوفر حالياً. يرجى التواصل مع الموارد البشرية.</p>
                </div>
              ) : previewUrl.startsWith("data:image/") || activePreviewDoc.fileName?.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                <img
                  src={previewUrl}
                  alt={activePreviewDoc.fileName || activePreviewDoc.name}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-md mx-auto"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={activePreviewDoc.fileName || activePreviewDoc.name}
                  className="w-full h-full rounded-xl border-0 bg-white shadow-inner"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </main>
  );
}
