"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Advance = {
  id: string; amount: string | number; reason: string; installments: number;
  paidInstallments: number; monthlyDeduction: string | number; startDate: string;
  status: string; managerStatus: string; hrStatus: string; financeStatus: string;
  notes?: string | null; createdAt: string;
};
const labels: Record<string, string> = {
  PENDING: 'بانتظار المراجعة', PENDING_MANAGER: 'بانتظار المدير', PENDING_HR: 'بانتظار الموارد البشرية',
  PENDING_FINANCE: 'بانتظار المالية', APPROVED: 'معتمد', REJECTED: 'مرفوض',
  CANCELLED: 'ملغى', PAID: 'مسدد', COMPLETED: 'مكتمل',
};
const money = (value: unknown) => Number(value ?? 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EmployeeAdvancesClient({ initialRecords }: { initialRecords: Advance[] }) {
  const [records, setRecords] = useState<Advance[]>(initialRecords || []);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [form, setForm] = useState({ amount: '', reason: '', installments: '1', startDate: '', notes: '' });
  const active = records.filter(record => record.status === 'APPROVED');
  const total = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const remaining = active.reduce((sum, record) => sum + Math.max(0, Math.round(Number(record.amount) * 100) - Math.round(Number(record.monthlyDeduction) * 100) * record.paidInstallments), 0) / 100;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError('');
    try {
      const response = await fetch('/api/employee/advances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'تعذر إرسال طلب السلفة');
      setRecords(current => [data.record, ...current]); setOpen(false);
      setForm({ amount: '', reason: '', installments: '1', startDate: '', notes: '' });
    } catch (error) { setError(error instanceof Error ? error.message : 'تعذر الاتصال، حاول مجددًا'); }
    finally { setPending(false); }
  }
  async function remove(id: string) {
    if (!confirm('حذف طلب السلفة؟')) return;
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/employee/advances?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'تعذر حذف الطلب');
      setRecords(current => current.filter(record => record.id !== id));
    } catch (error) { setError(error instanceof Error ? error.message : 'تعذر الاتصال، حاول مجددًا'); }
    finally { setPending(false); }
  }
  return <main className="payroll-workspace min-w-0 space-y-6" dir="rtl">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-black sm:text-3xl">طلبات السلف</h1><p className="mt-2 text-sm text-muted-foreground">تابع المبلغ والأقساط وحالة موافقات طلبك.</p></div><Button onClick={() => { setOpen(true); setError(''); }}>طلب سلفة جديدة</Button></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <section aria-label="ملخص السلف" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["المتبقي من السلف المعتمدة", `${money(remaining)} ر.س`], ["عدد طلبات السلف", records.length], ["السلف المعتمدة", active.length], ["إجمالي المبالغ المطلوبة", `${money(total)} ر.س`]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-xl font-bold tabular-nums">{value}</p></CardContent></Card>)}
    </section>
    {open && <form onSubmit={submit} aria-label="طلب سلفة جديدة" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-bold">طلب سلفة جديدة</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm"><span>قيمة السلفة (ر.س)</span><Input required type="number" inputMode="decimal" max="9999999999.99" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="space-y-2 text-sm"><span>عدد الأقساط الشهرية</span><Input required type="number" inputMode="numeric" max="2147483647" min="1" step="1" value={form.installments} onChange={event => setForm({ ...form, installments: event.target.value })} /></label>
        <label className="space-y-2 text-sm"><span>تاريخ بدء الاستقطاع (اختياري)</span><Input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label>
        <label className="space-y-2 text-sm"><span>سبب السلفة</span><Input required minLength={3} maxLength={1000} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></label>
        <label className="space-y-2 text-sm sm:col-span-2"><span>ملاحظات (اختياري)</span><textarea maxLength={2000} className="min-h-24 w-full rounded-xl border bg-background p-3" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <p className="text-xs text-muted-foreground">يُحدد القسط النهائي عند مراجعة الطلب واعتماده.</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending}>{pending ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>إلغاء</Button></div>
    </form>}
    <section className="grid gap-4" aria-label="طلبات السلف السابقة">{records.map(record => <Card key={record.id} className="rounded-2xl">
      <CardHeader className="p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="break-words text-xl">{money(record.amount)} ر.س</CardTitle><span className="rounded-full border px-3 py-1 text-xs">{labels[record.status] ?? record.status}</span></div></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0"><p className="text-sm text-muted-foreground">{record.reason}</p>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3 text-sm">{[['القسط الشهري', `${money(record.monthlyDeduction)} ر.س`], ['عدد الأقساط', record.installments], ['الأقساط المسددة', record.paidInstallments], ['بدء الاستقطاع', new Date(record.startDate).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' })]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>
        {record.notes && <p className="text-sm">ملاحظات: {record.notes}</p>}
        <ol aria-label="مراحل اعتماد السلفة" className="grid gap-2 text-sm sm:grid-cols-3">{[['المدير', record.managerStatus], ['الموارد البشرية', record.hrStatus], ['المالية', record.financeStatus]].map(([label, status]) => <li key={label} className="rounded-xl border p-3"><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{labels[status] ?? status}</p></li>)}</ol>
        {record.status === 'PENDING_MANAGER' && <Button size="sm" variant="destructive" onClick={() => void remove(record.id)} disabled={pending}>حذف الطلب</Button>}
      </CardContent>
    </Card>)}{!records.length && <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد طلبات سلفة حتى الآن.</p>}</section>
  </main>;
}
