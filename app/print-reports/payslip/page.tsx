"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

type PayslipData = {
  companyName: string;
  companyLogo: string | null;
  qrDataUrl: string | null;
  item: {
    period: string; runName: string; runStatus: string; paidAt: string | null; currency: string;
    baseSalary: number; allowanceTotal: number; bonusTotal: number; overtimeTotal: number; grossPay: number;
    insuranceDeduction: number; taxTotal: number; loanDeduction: number; advanceDeduction: number;
    absenceDeduction: number; lateDeduction: number; penaltyDeduction: number; deductionTotal: number; netPay: number;
    costCenter: string | null;
  };
  employee: { employeeNumber: string; name: string; nationalId: string; department: string | null; position: string | null; branch: string | null; bank: string | null; iban: string | null };
};

function row(label: string, value: number, currency: string, positive = true) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-slate-200 py-1.5 text-sm">
      <span>{label}</span>
      <span className={`font-bold ${positive ? "text-emerald-700" : "text-rose-700"}`}>{positive ? "" : "-"}{value.toLocaleString("ar-SA")} {currency}</span>
    </div>
  );
}

function PayslipContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PayslipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const itemId = searchParams.get("itemId");
    if (!itemId) { setError("لم يتم تحديد سجل الراتب"); setLoading(false); return; }
    fetch(`/api/enterprise/payroll/payslip?itemId=${encodeURIComponent(itemId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); else setError(d.message || "تعذر تحميل كشف الراتب"); })
      .catch(() => setError("تعذر تحميل كشف الراتب"))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>;
  if (error || !data) return <div className="p-8 text-center text-rose-600">{error}</div>;

  const { item, employee } = data;

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0" dir="rtl">
      <style dangerouslySetInnerHTML={{
        __html: `@media print { @page { size: A4; margin: 14mm; } .no-print { display: none !important; } body { background: white; } }`
      }} />

      <div className="no-print mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">معاينة قبل الطباعة -- استخدم "طباعة" ثم اختر "حفظ كـ PDF" من نافذة الطباعة.</p>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Printer className="h-4 w-4" /> طباعة / حفظ PDF
        </button>
      </div>

      <div className="rounded-2xl border-2 border-slate-800 p-8">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            {data.companyLogo && <img src={data.companyLogo} alt="" className="h-14 w-14 object-contain" />}
            <div>
              <h1 className="text-xl font-black">{data.companyName}</h1>
              <p className="text-sm text-slate-500">كشف راتب -- {item.period}</p>
            </div>
          </div>
          {data.qrDataUrl && <img src={data.qrDataUrl} alt="QR" className="h-20 w-20" />}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div><p className="text-xs text-slate-500">اسم الموظف</p><p className="font-bold">{employee.name}</p></div>
          <div><p className="text-xs text-slate-500">الرقم الوظيفي</p><p className="font-bold">{employee.employeeNumber}</p></div>
          <div><p className="text-xs text-slate-500">القسم</p><p className="font-bold">{employee.department ?? "-"}</p></div>
          <div><p className="text-xs text-slate-500">الفرع</p><p className="font-bold">{employee.branch ?? "-"}</p></div>
          <div><p className="text-xs text-slate-500">المسمى الوظيفي</p><p className="font-bold">{employee.position ?? "-"}</p></div>
          <div><p className="text-xs text-slate-500">مركز التكلفة</p><p className="font-bold">{item.costCenter ?? "-"}</p></div>
          {employee.iban && <div className="col-span-2"><p className="text-xs text-slate-500">الحساب البنكي</p><p className="font-bold font-mono">{employee.bank} -- {employee.iban}</p></div>}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-emerald-700 mb-2">الإضافات</p>
            {row("الراتب الأساسي", item.baseSalary, item.currency)}
            {row("البدلات", item.allowanceTotal, item.currency)}
            {row("الإضافي", item.overtimeTotal, item.currency)}
            {row("المكافآت والعمولات", item.bonusTotal, item.currency)}
            <div className="flex justify-between pt-2 text-sm font-black"><span>الإجمالي</span><span>{item.grossPay.toLocaleString("ar-SA")} {item.currency}</span></div>
          </div>
          <div>
            <p className="text-xs font-bold text-rose-700 mb-2">الاستقطاعات</p>
            {row("التأمينات الاجتماعية", item.insuranceDeduction, item.currency, false)}
            {row("الضرائب", item.taxTotal, item.currency, false)}
            {row("القروض", item.loanDeduction, item.currency, false)}
            {row("السلف", item.advanceDeduction, item.currency, false)}
            {row("الغياب", item.absenceDeduction, item.currency, false)}
            {row("التأخير", item.lateDeduction, item.currency, false)}
            {row("الجزاءات", item.penaltyDeduction, item.currency, false)}
            <div className="flex justify-between pt-2 text-sm font-black"><span>إجمالي الاستقطاعات</span><span>-{item.deductionTotal.toLocaleString("ar-SA")} {item.currency}</span></div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-slate-900 p-4 text-center text-white">
          <p className="text-xs opacity-80">صافي الراتب</p>
          <p className="text-2xl font-black">{item.netPay.toLocaleString("ar-SA")} {item.currency}</p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">تم إصدار هذا الكشف إلكترونياً من نظام Lana HRMS بتاريخ {new Date().toLocaleDateString("ar-SA")}</p>
      </div>
    </div>
  );
}

export default function PayslipPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">جاري التحميل...</div>}>
      <PayslipContent />
    </Suspense>
  );
}
