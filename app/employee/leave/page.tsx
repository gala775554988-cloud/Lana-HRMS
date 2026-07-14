import Link from 'next/link';
import { requireEmployee, asNumber, fmtDate } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


export default async function LeavePage() {
  const { employee } = await requireEmployee();
  const [types, requests] = await Promise.all([
    prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.leaveRequest.findMany({ where: { employeeId: employee.id }, include: { leaveType: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  // Per-type balances (was previously a single total/used aggregated across
  // every leave type, which hid how much of each specific type was left).
  const balances = types.map((type) => {
    const total = type.annualLimit || 0;
    const used = requests
      .filter((r) => r.leaveTypeId === type.id && r.status === 'APPROVED')
      .reduce((sum, r) => sum + asNumber(r.days), 0);
    return { id: type.id, name: type.name, total, used, remaining: Math.max(total - used, 0) };
  });

  return <main className="space-y-6" dir="rtl"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-black">الإجازات</h1><p className="text-muted-foreground">الأرصدة وطلبات الإجازة وسير الموافقات.</p></div><Button asChild><Link href="/employee/leave/new">طلب إجازة</Link></Button></div><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{balances.map((balance) => <Card key={balance.id} className="rounded-3xl"><CardContent className="p-5 space-y-2"><p className="font-bold">{balance.name}</p><div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-muted-foreground">الرصيد</p><p className="text-xl font-black">{balance.total}</p></div><div><p className="text-xs text-muted-foreground">المستهلك</p><p className="text-xl font-black">{balance.used}</p></div><div><p className="text-xs text-muted-foreground">المتبقي</p><p className="text-xl font-black">{balance.remaining}</p></div></div></CardContent></Card>)}{!balances.length && <div className="rounded-2xl border border-dashed p-6 text-muted-foreground md:col-span-2 xl:col-span-3">لا توجد أنواع إجازات مفعّلة.</div>}</section><Card className="rounded-3xl"><CardHeader><CardTitle>طلبات الإجازة</CardTitle></CardHeader><CardContent className="space-y-3">{requests.map(r=><div key={r.id} className="rounded-2xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{r.leaveType?.name ?? 'إجازة'} · {asNumber(r.days)} يوم</p><p className="text-xs text-muted-foreground">{fmtDate(r.startDate)} - {fmtDate(r.endDate)} · {r.reason || '—'}</p></div><span className="rounded-full border px-3 py-1 text-xs">{r.status}</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-700">Employee</span><span className="rounded-xl bg-slate-50 p-2">Manager</span><span className="rounded-xl bg-slate-50 p-2">HR</span><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">Approved</span></div></div>)}{!requests.length&&<div className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد طلبات إجازة بعد.</div>}</CardContent></Card></main>;
}
