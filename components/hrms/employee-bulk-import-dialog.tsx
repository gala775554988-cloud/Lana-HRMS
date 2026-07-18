"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: "ar" | "en";
}

type ImportError = { row: number; field?: string; message: string };
type Analysis = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicates: number;
  newEmployees: number;
  existingEmployees: number;
  errors: ImportError[];
};

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

export function EmployeeBulkImportDialog({ open, onOpenChange, locale = "ar" }: BulkImportDialogProps) {
  const isAr = locale === "ar";
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoCreateReferences, setAutoCreateReferences] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update" | "ignore">("skip");

  const canImport = useMemo(() => Boolean(file && analysis && analysis.errors.length === 0), [analysis, file]);

  const labels = {
    title: isAr ? "استيراد الموظفين" : "Bulk Import Employees",
    choose: isAr ? "اختر ملف Excel أو CSV" : "Choose Excel or CSV file",
    template: isAr ? "تحميل قالب Excel" : "Download Template",
    analyze: isAr ? "تحليل الملف" : "Analyze File",
    import: isAr ? "بدء الاستيراد" : "Start Import",
    autoCreate: isAr ? "إنشاء العناصر الناقصة تلقائياً" : "Auto-create missing references",
    duplicate: isAr ? "الموظف الموجود مسبقاً" : "Existing employee handling",
    skip: isAr ? "تخطي الموجود" : "Skip existing",
    update: isAr ? "تحديث الموجود" : "Update existing",
    ignore: isAr ? "تجاهل الصف" : "Ignore row",
    errorReport: isAr ? "تحميل تقرير الأخطاء" : "Download Error Report",
    report: isAr ? "تحميل التقرير" : "Download Report"
  };

  function options() {
    return JSON.stringify({ autoCreateReferences, duplicateStrategy });
  }

  async function analyze() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    setProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "analyze");
    formData.append("options", options());
    const response = await fetch("/api/enterprise/bulk-import/employees", { method: "POST", body: formData });
    const data = await response.json();
    setProgress(100);
    setBusy(false);
    if (!data.success) {
      setMessage(data.message || "Failed to analyze file");
      return;
    }
    setAnalysis(data.analysis);
  }

  async function startImport() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "import");
    formData.append("options", options());
    setProgress(20);
    const response = await fetch("/api/enterprise/bulk-import/employees", { method: "POST", body: formData });
    setProgress(80);
    const data = await response.json();
    setProgress(100);
    setBusy(false);
    if (!data.success) {
      setAnalysis(data.analysis ?? analysis);
      setMessage(data.message || "Import failed");
      return;
    }
    setAnalysis(data.analysis);
    setResult(data.result);
  }

  function downloadTemplate() {
    window.location.href = "/api/enterprise/bulk-import/employees";
  }

  function downloadErrorReport() {
    downloadCsv("lana-hrms-import-errors.csv", (analysis?.errors ?? []).map((error) => ({ row: error.row, field: error.field, message: error.message })));
  }

  function downloadResultReport() {
    if (!result) return;
    downloadCsv("lana-hrms-import-result.csv", [result]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />{labels.title}</DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadTemplate} className="gap-2"><Download className="h-4 w-4" />{labels.template}</Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>{labels.choose}</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setAnalysis(null); setResult(null); setProgress(0); }} />
            {file ? <span className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">{file.name}</span> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm md:col-span-2">
              <input type="checkbox" checked={autoCreateReferences} onChange={(event) => setAutoCreateReferences(event.target.checked)} />
              {labels.autoCreate}
            </label>
            <label className="grid gap-1 text-sm">
              <span>{labels.duplicate}</span>
              <select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as any)} className="h-10 rounded-xl border bg-background px-3">
                <option value="skip">{labels.skip}</option>
                <option value="update">{labels.update}</option>
                <option value="ignore">{labels.ignore}</option>
              </select>
            </label>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={analyze} disabled={!file || busy}>0% / 20% / 40% / 60% / 80% / 100% - {labels.analyze}</Button>
            <Button type="button" onClick={startImport} disabled={!canImport || busy} className="gap-2"><UploadCloud className="h-4 w-4" />{labels.import}</Button>
          </div>

          {message ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div> : null}

          {analysis ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label={isAr ? "عدد الموظفين" : "Total employees"} value={analysis.totalRows} />
                <Stat label={isAr ? "الصفوف الصحيحة" : "Valid rows"} value={analysis.validRows} />
                <Stat label={isAr ? "الصفوف الخاطئة" : "Invalid rows"} value={analysis.errorRows} />
                <Stat label={isAr ? "المكررون" : "Duplicates"} value={analysis.duplicates} />
                <Stat label={isAr ? "الموظفون الجدد" : "New employees"} value={analysis.newEmployees} />
              </div>
              {analysis.errors.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <strong>{isAr ? "تقرير الأخطاء" : "Error report"}</strong>
                    <Button type="button" size="sm" variant="outline" onClick={downloadErrorReport}>{labels.errorReport}</Button>
                  </div>
                  <div className="max-h-56 overflow-auto space-y-1">
                    {analysis.errors.slice(0, 200).map((error, index) => <div key={index}>{isAr ? "الصف" : "Row"} {error.row || "-"}: {error.message}</div>)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-xl border bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="mb-2 flex items-center justify-between gap-3">
                <strong>{isAr ? "اكتمل الاستيراد" : "Import completed"}</strong>
                <Button type="button" size="sm" variant="outline" onClick={downloadResultReport}>{labels.report}</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Stat label={isAr ? "تمت إضافة" : "Added"} value={result.added} />
                <Stat label={isAr ? "تم تحديث" : "Updated"} value={result.updated} />
                <Stat label={isAr ? "تم تجاهل" : "Skipped"} value={result.skipped} />
                <Stat label={isAr ? "عدد الأخطاء" : "Errors"} value={result.errors} />
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
