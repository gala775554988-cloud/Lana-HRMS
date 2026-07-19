"use client";

import React, { useState, useRef, useMemo, useTransition } from "react";
import { Search, UploadCloud, FolderPlus, FileText, Eye, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

export function EmployeeDocumentsPortal({ employeeId, initialDocuments }: { employeeId: string; initialDocuments: any[] }) {
  const [docs, setDocs] = useState(initialDocuments);
  const [folders, setFolders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activePreviewDoc, setActivePreviewDoc] = useState<any | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => docs.filter((d) => !search || [d.name, d.fileName, d.type, d.status].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()))), [docs, search]);

  function upload(files?: FileList | File[]) {
    if (!files?.length) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("employeeId", employeeId);
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await fetch("/api/employees/documents", { method: "POST", body: form });
      const json = await res.json();
      if (json.success) setDocs((d) => [...(json.documents || []), ...d]);
      else alert(json.message || "فشل الرفع");
    });
  }

  function folder() {
    const name = prompt("اسم المجلد");
    if (!name) return;
    startTransition(async () => {
      const res = await fetch("/api/employees/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "folder", employeeId, folderName: name })
      });
      const json = await res.json();
      if (json.success) setFolders(json.folders || []);
      else alert(json.message || "فشل إنشاء المجلد");
    });
  }

  function del(id: string) {
    if (!confirm("حذف المستند؟")) return;
    startTransition(async () => {
      const res = await fetch(`/api/employees/documents?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) setDocs((d) => d.filter((x) => x.id !== id));
      else alert(json.message || "فشل الحذف");
    });
  }

  const handleDownloadDocument = (doc: any) => {
    const url = doc.fileUrl || doc.attachmentUrl;
    if (!url) {
      alert("⚠️ رابط تحميل المستند غير متوفر في النظام حالياً.");
      return;
    }
    if (url.startsWith("data:")) {
      try {
        const arr = url.split(",");
        const mime = arr[0].match(/:(.*?);/)?.[1] || "application/pdf";
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = doc.fileName || doc.name || `document-${doc.id || "file"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.fileName || doc.name || "document.pdf";
        link.click();
      }
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.download = doc.fileName || doc.name || `document-${doc.id || "file"}.pdf`;
    link.target = "_self";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="space-y-6 font-sans" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">المستندات</h1>
        <p className="text-muted-foreground font-semibold">رفع ومعاينة وتنزيل مستنداتك الرسمية بسهولة وسرعة فك الارتباط دون تعقيد.</p>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث سريع بالمستندات..." className="pr-10 h-11 rounded-xl font-bold" />
        </div>
        <Button disabled={pending} onClick={() => inputRef.current?.click()} className="bg-primary text-white h-11 rounded-xl px-5 font-black gap-2 shadow-sm">
          <UploadCloud className="h-4 w-4" />
          <span>رفع متعدد</span>
        </Button>
        <Button disabled={pending} variant="outline" onClick={folder} className="h-11 rounded-xl px-5 font-bold gap-2">
          <FolderPlus className="h-4 w-4 text-primary" />
          <span>مجلد جديد</span>
        </Button>
        <input ref={inputRef} className="hidden" type="file" multiple onChange={(e) => upload(e.target.files || undefined)} />
      </div>

      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {folders.map((f) => (
            <span key={f} className="rounded-2xl border border-primary/30 bg-primary/10 text-primary px-3.5 py-1 text-xs font-black flex items-center gap-1.5 shadow-2xs">
              📁 {f}
            </span>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-10 text-center hover:border-primary/50 transition bg-slate-50/50 dark:bg-slate-900/40 space-y-2"
      >
        <UploadCloud className="mx-auto h-12 w-12 text-primary/70" />
        <p className="font-black text-slate-800 dark:text-slate-200">اسحب وأفلت الملفات والمستندات هنا</p>
        <p className="text-xs font-bold text-muted-foreground">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP, RAR, PNG, JPG, WEBP, MP4, MOV, TXT</p>
        <Button className="mt-3 bg-primary text-white rounded-xl px-6 font-bold text-xs" onClick={() => inputRef.current?.click()}>
          اختر ملفات من جهازك
        </Button>
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadDocument(doc)}
                className="rounded-xl h-8 px-3 font-extrabold text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                title="تحميل المستند مباشرة بسهولة"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>تنزيل</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => del(doc.id)}
                className="rounded-xl h-8 px-2.5 text-xs font-bold"
                title="حذف المستند"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-muted-foreground font-bold text-sm col-span-full">
            لا توجد مستندات مطابقة للبحث أو الرفع حتى الآن.
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
                <Button
                  onClick={() => handleDownloadDocument(activePreviewDoc)}
                  className="bg-primary text-white hover:bg-primary/90 font-black text-xs h-10 px-5 rounded-xl shadow-xs gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  <span>تنزيل المستند بسهولة</span>
                </Button>
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
              {(activePreviewDoc.fileUrl || activePreviewDoc.attachmentUrl)?.startsWith("data:image/") || activePreviewDoc.fileName?.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                <img
                  src={activePreviewDoc.fileUrl || activePreviewDoc.attachmentUrl}
                  alt={activePreviewDoc.fileName || activePreviewDoc.name}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-md mx-auto"
                />
              ) : (
                <iframe
                  src={activePreviewDoc.fileUrl || activePreviewDoc.attachmentUrl}
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
