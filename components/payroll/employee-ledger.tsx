"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Balance = { currency: string; credits: string; debits: string; net: string };
type Entry = { id: string; sourceType: string; effectType: string; direction: string; amount: string; currency: string; occurredAt: string; state: string };
type Execution = { requestType?: string; id: string; sourceType: string; effectType: string; state: string; createdAt: string };
type Ledger = { balances: Balance[]; entries: Entry[]; recentExecutions: Execution[]; total: number; pageSize: number };

const labels: Record<string,string> = { LEAVE: "إجازة", OVERTIME: "عمل إضافي", BONUS: "مكافأة", ADVANCE: "سلفة", PAYROLL: "مسير راتب", CREDIT: "إضافة", DEBIT: "خصم", INFORMATION: "معلومة", EXECUTED: "منفذ", POSTED: "مسجل", REVERSED: "معكوس" };
Object.assign(labels, { FINAL_SETTLEMENT:"مخالصة نهائية", EOSB:"مكافأة نهاية الخدمة", UNPAID_SALARY:"أجر غير مصروف", LEAVE_ENCASHMENT:"مقابل الإجازات", OTHER_ENTITLEMENTS:"مستحقات أخرى", PAYMENT_CONFIRMED:"تأكيد الصرف", BASIC: "الراتب الأساسي", ALLOWANCES: "البدلات", GOSI: "التأمينات", TAX: "الضرائب", ABSENCE: "الغياب", LATE: "التأخير", PENALTY: "الجزاءات", OTHER_DEDUCTIONS: "خصومات أخرى", LOAN: "قسط قرض", ADVANCE: "قسط سلفة", GROSS_PAY: "إجمالي الأجر", DEDUCTIONS: "إجمالي الخصومات", WORKFLOW: "طلب موظف", APPROVAL_RECORDED: "تم تسجيل الاعتماد", APPROVAL: "اعتماد", EXPENSE: "مصروفات", RESUMPTION: "مباشرة", LETTER: "خطاب" });
const label = (key: string) => labels[key.split(":")[0]] ?? key;
export function EmployeeLedger() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/employee/financial-ledger?page=" + page, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("تعذر تحميل الحساب المالي");
        const payload = await response.json();
        if (!payload.success) throw new Error("تعذر تحميل الحساب المالي");
        if (!controller.signal.aborted) setData(payload);
      })
      .catch(() => { if (!controller.signal.aborted) { setData(null); setError("تعذر تحميل الحساب المالي. أعد المحاولة."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);
  return <section dir="rtl" className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
    <h2 className="text-xl font-bold">السجل المالي الموحد</h2>
    <p className="text-sm text-muted-foreground">إجماليات القيود المسجلة في هذا السجل، وليست رصيدًا بنكيًا أو كشفًا تاريخيًا شاملًا.</p>
    {loading && <p role="status">جارٍ التحميل…</p>}
    {error && <p role="alert">{error}</p>}
    {data && !loading && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.balances.map(row => <article key={row.currency} className="rounded-xl border bg-background p-4"><h3 className="font-semibold">{row.currency}</h3><p>الإضافات: <b dir="ltr">{row.credits}</b></p><p>الخصومات: <b dir="ltr">{row.debits}</b></p><p>الصافي: <b dir="ltr">{row.net}</b></p></article>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-right"><th className="p-2">التاريخ</th><th className="p-2">المصدر</th><th className="p-2">النوع</th><th className="p-2">المبلغ</th><th className="p-2">الحالة</th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.id} className="border-b"><td className="whitespace-nowrap p-2">{new Date(entry.occurredAt).toLocaleDateString("ar-SA")}</td><td className="p-2">{label(entry.sourceType)}</td><td className="p-2">{label(entry.effectType)} · {label(entry.direction)}</td><td className="whitespace-nowrap p-2" dir="ltr">{entry.amount} {entry.currency}</td><td className="p-2">{label(entry.state)}</td></tr>)}</tbody></table></div>
      {!data.entries.length && <p>لا توجد قيود مسجلة في هذه الصفحة.</p>}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button><span>{page}</span><Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>التالي</Button></div>
      <h3 className="font-semibold">آخر إجراءات الطلبات</h3>
      {data.recentExecutions.map(entry => <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"><span>{label(entry.requestType ?? entry.sourceType)} — {label(entry.effectType)}</span><span>{label(entry.state)} · {new Date(entry.createdAt).toLocaleDateString("ar-SA")}</span></div>)}
      {!data.recentExecutions.length && <p className="text-sm text-muted-foreground">لا توجد إجراءات مسجلة بعد.</p>}
    </>}
  </section>;
}
