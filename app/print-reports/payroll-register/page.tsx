"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

function PrintReportContent() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "json");
    if (!params.get("report")) params.set("report", "register");
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/enterprise/payroll/export?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "تعذر تحميل تقرير الرواتب");
        setTitle(data.title);
        setRows(data.rows);
      })
      .catch(error => { if (!controller.signal.aborted) { setRows([]); setError(error.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [searchParams, revision]);

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="payroll-workspace mx-auto min-w-0 max-w-6xl p-4 sm:p-8 print:p-0" dir="rtl">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { size: A4 landscape; margin: 12mm; }
            .no-print { display: none !important; }
            body { background: white; }
          }
        `
      }} />

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">معاينة قبل الطباعة -- استخدم "طباعة" ثم اختر "حفظ كـ PDF" من نافذة الطباعة.</p>
        <button
          type="button"
          disabled={loading || !!error || !rows.length}
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" /> طباعة / حفظ PDF
        </button>
      </div>

      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-black">{title || "تقرير الرواتب"}</h1>
        <p className="mt-1 text-sm text-slate-500">تاريخ الإصدار: {new Date().toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })} -- عدد السجلات: {rows.length}</p>
      </div>

      {error ? (
        <div role="alert" className="no-print space-y-3 rounded-xl border border-rose-200 p-4 text-rose-700"><p>{error}</p><button className="rounded-lg border px-4 py-2" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button></div>
      ) : loading ? (
        <p className="text-center text-slate-500">جاري تحميل التقرير...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-500">لا توجد بيانات مطابقة لهذا التقرير.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border print:overflow-visible print:border-0" role="region" aria-label="كشف الرواتب، قابل للتمرير أفقيًا" tabIndex={0}><table className="w-full min-w-[760px] border-collapse text-xs print:min-w-0 print:table-fixed">
          <thead>
            <tr className="border-b-2 border-slate-800">
              {columns.map((col) => (
                <th key={col} className="p-2 text-right font-bold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-200">
                {columns.map((col) => (
                  <td key={col} className="break-words p-2 text-right">{typeof row[col] === "number" ? (row[col] as number).toLocaleString("ar-SA") : String(row[col] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

export default function PayrollRegisterPrintReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">جاري التحميل...</div>}>
      <PrintReportContent />
    </Suspense>
  );
}
