"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface OvertimeBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

type ImportError = { row: number; field?: string; message: string };
type Analysis = { totalRows: number; validRows: number; errorRows: number; errors: ImportError[] };
type ImportResult = { added: number; updated: number; skipped: number; errors: number; total: number };

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function OvertimeBulkImportDialog({ open, onOpenChange, onImported }: OvertimeBulkImportDialogProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const canImport = useMemo(() => Boolean(file && analysis && analysis.validRows > 0), [analysis, file]);

  async function analyze() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    setProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "analyze");
    const response = await fetch("/api/enterprise/overtime/bulk-import", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({ success: false, message: "استجابة غير صالحة" }));
    setProgress(100);
    setBusy(false);
    if (!data.success) {
      setMessage(data.message || "فشل تحليل الملف");
      return;
    }
    setAnalysis(data.analysis);
  }

  async function startImport() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "import");
    const response = await fetch("/api/enterprise/overtime/bulk-import", { method: "POST", body: formData });
    setProgress(80);
    const data = await response.json().catch(() => ({ success: false, message: "استجابة غير صالحة" }));
    setProgress(100);
    setBusy(false);
    if (!data.success) {
      setAnalysis(data.analysis ?? analysis);
      setMessage(data.message || "فشل الاستيراد");
      return;
    }
    setAnalysis(data.analysis);
    setResult(data.result);
    onImported?.();
  }

  function downloadTemplate() {
    window.location.href = "/api/enterprise/overtime/bulk-import";
  }

  function downloadErrorReport() {
    downloadCsv("lana-hrms-overtime-import-errors.csv", (analysis?.errors ?? []).map((error) => ({ row: error.row, field: error.field, message: error.message })));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />استيراد الأوفر تايم بالجملة</DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadTemplate} className="gap-2"><Download className="h-4 w-4" />تحميل قالب Excel</Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>اختر ملف Excel أو CSV</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setAnalysis(null); setResult(null); setProgress(0); }} />
            {file ? <span className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">{file.name}</span> : null}
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={analyze} disabled={!file || busy}>تحليل الملف</Button>
            <Button type="button" onClick={startImport} disabled={!canImport || busy} className="gap-2"><UploadCloud className="h-4 w-4" />بدء الاستيراد</Button>
          </div>

          {message ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div> : null}

          {analysis ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="إجمالي الصفوف" value={analysis.totalRows} />
                <Stat label="الصفوف الصحيحة" value={analysis.validRows} />
                <Stat label="الصفوف الخاطئة" value={analysis.errorRows} />
              </div>
              {analysis.errors.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <strong>تقرير الأخطاء</strong>
                    <Button type="button" size="sm" variant="outline" onClick={downloadErrorReport}>تحميل تقرير الأخطاء</Button>
                  </div>
                  <div className="max-h-56 overflow-auto space-y-1">
                    {analysis.errors.slice(0, 200).map((error, index) => <div key={index}>الصف {error.row || "-"}: {error.message}</div>)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-xl border bg-emerald-50 p-4 text-sm text-emerald-800">
              <strong className="mb-2 block">اكتمل الاستيراد</strong>
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="تمت الإضافة" value={result.added} />
                <Stat label="تم التجاهل" value={result.skipped} />
                <Stat label="عدد الأخطاء" value={result.errors} />
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold">{value}</div></div>;
}
