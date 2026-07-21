"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

function PrintReportContent() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "json");
    if (!params.get("report")) params.set("report", "register");
    fetch(`/api/enterprise/payroll/export?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) { setTitle(d.title); setRows(d.rows); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="mx-auto max-w-6xl p-8 print:p-0" dir="rtl">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { size: A4 landscape; margin: 12mm; }
            .no-print { display: none !important; }
            body { background: white; }
          }
        `
      }} />

      <div className="no-print mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">معاينة قبل الطباعة -- استخدم "طباعة" ثم اختر "حفظ كـ PDF" من نافذة الطباعة.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
        >
          <Printer className="h-4 w-4" /> طباعة / حفظ PDF
        </button>
      </div>

      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-black">{title || "تقرير الرواتب"}</h1>
        <p className="mt-1 text-sm text-slate-500">تاريخ الإصدار: {new Date().toLocaleDateString("ar-SA")} -- عدد السجلات: {rows.length}</p>
      </div>

      {loading ? (
        <p className="text-center text-slate-500">جاري تحميل التقرير...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-500">لا توجد بيانات مطابقة لهذا التقرير.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
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
                  <td key={col} className="p-2 text-right">{typeof row[col] === "number" ? (row[col] as number).toLocaleString("ar-SA") : String(row[col] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
