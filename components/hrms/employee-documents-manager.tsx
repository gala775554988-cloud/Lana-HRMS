"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FileText, FolderPlus, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentRow = {
  id?: string;
  name?: unknown;
  type?: unknown;
  fileUrl?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  status?: unknown;
  uploadedAt?: unknown;
};

type Props = {
  employeeId: string;
  initialDocuments: DocumentRow[];
};

function formatSize(value: unknown) {
  const size = Number(value ?? 0);
  if (!size) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function EmployeeDocumentsManager({ employeeId, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments ?? []);
  const [folders, setFolders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) => [doc.name, doc.fileName, doc.type, doc.status].some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }, [documents, search]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setMessage(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("action", "upload");
      for (const file of list) form.append("files", file);
      const response = await fetch(`/api/enterprise/employees/${employeeId}/documents`, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setMessage(data?.message ?? "فشل رفع الملفات");
        return;
      }
      setDocuments((current) => [...(data.documents ?? []), ...current]);
      setMessage(`تم رفع ${data.documents?.length ?? list.length} ملف بنجاح`);
    });
  }

  function createFolder() {
    const folderName = window.prompt("اسم المجلد الجديد");
    if (!folderName?.trim()) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("action", "folder");
      form.set("folderName", folderName.trim());
      const response = await fetch(`/api/enterprise/employees/${employeeId}/documents`, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setMessage(data?.message ?? "فشل إنشاء المجلد");
        return;
      }
      setFolders(data.folders ?? []);
      setMessage("تم إنشاء المجلد");
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold">المستندات</h2>
        <p className="mt-2 text-muted-foreground">مساحة مستندات الموظف - يدعم جميع الصيغ PDF, Word, Excel, PPT, ZIP, RAR, PNG, JPG, WEBP, MP4, MOV, TXT, CSV, XML</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[260px] flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute right-4 top-3 h-5 w-5 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-12 w-full rounded-2xl border bg-background pr-12 text-sm" placeholder="بحث سريع..." />
        </label>
        <Button disabled={isPending} onClick={() => inputRef.current?.click()} className="h-12 rounded-2xl gap-2"><UploadCloud className="h-5 w-5" />رفع متعدد</Button>
        <Button disabled={isPending} onClick={createFolder} variant="outline" className="h-12 rounded-2xl gap-2"><FolderPlus className="h-5 w-5" />مجلد جديد</Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && uploadFiles(event.target.files)} />
      </div>
      {message ? <div className="rounded-xl border bg-muted p-3 text-sm text-muted-foreground">{message}</div> : null}
      {folders.length ? <div className="flex flex-wrap gap-2">{folders.map((folder) => <span key={folder} className="rounded-full border bg-muted px-3 py-1 text-sm">📁 {folder}</span>)}</div> : null}
      <div
        className={`rounded-3xl border-2 border-dashed p-10 text-center transition ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20"}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); uploadFiles(event.dataTransfer.files); }}
      >
        <UploadCloud className="mx-auto h-14 w-14 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-bold">اسحب وأفلت الملفات هنا</h3>
        <p className="mt-2 text-sm text-muted-foreground">وأي صيغة أخرى مدعومة PDF, Word, Excel, PPT, ZIP, RAR, PNG, JPG, JPEG, WEBP, MP4, MOV, TXT, CSV, XML</p>
        <Button disabled={isPending} onClick={() => inputRef.current?.click()} className="mt-6 rounded-2xl">اختر ملفات</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((doc, index) => (
          <a key={String(doc.id ?? index)} href={typeof doc.fileUrl === "string" ? doc.fileUrl : "#"} target="_blank" rel="noreferrer" className="rounded-2xl border p-4 transition hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{String(doc.fileName ?? doc.name ?? "مستند")}</p>
                <p className="text-xs text-muted-foreground">{String(doc.type ?? "DOCUMENT")} · {formatSize(doc.sizeBytes)} · {String(doc.status ?? "PENDING")}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
