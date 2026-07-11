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
  const used = requests.filter(r=>r.status==='APPROVED').reduce((s,r)=>s+asNumber(r.days),0);
  const total = types.reduce((s,t)=>s+(t.annualLimit || 0),0) || 30;
  return <main className="space-y-6" dir="rtl"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-black">الإجازات</h1><p className="text-muted-foreground">الأرصدة وطلبات الإجازة وسير الموافقات.</p></div><Button asChild><Link href="/employee/leave/new">طلب إجازة</Link></Button></div><section className="grid gap-4 md:grid-cols-3"><Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">الرصيد</p><p className="text-3xl font-black">{total}</p></CardContent></Card><Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">المستهلك</p><p className="text-3xl font-black">{used}</p></CardContent></Card><Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">المتبقي</p><p className="text-3xl font-black">{Math.max(total-used,0)}</p></CardContent></Card></section><Card className="rounded-3xl"><CardHeader><CardTitle>طلبات الإجازة</CardTitle></CardHeader><CardContent className="space-y-3">{requests.map(r=><div key={r.id} className="rounded-2xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{r.leaveType?.name ?? 'إجازة'} · {asNumber(r.days)} يوم</p><p className="text-xs text-muted-foreground">{fmtDate(r.startDate)} - {fmtDate(r.endDate)} · {r.reason || '—'}</p></div><span className="rounded-full border px-3 py-1 text-xs">{r.status}</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-700">Employee</span><span className="rounded-xl bg-slate-50 p-2">Manager</span><span className="rounded-xl bg-slate-50 p-2">HR</span><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">Approved</span></div></div>)}{!requests.length&&<div className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد طلبات إجازة بعد.</div>}</CardContent></Card></main>;
}
