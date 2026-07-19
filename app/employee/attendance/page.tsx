import { requireEmployee, fmtDate } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Timer, AlertTriangle, TrendingUp } from 'lucide-react';
import { EmployeeMobileAttendancePunch } from '@/components/employee/EmployeeMobileAttendancePunch';

export const dynamic = "force-dynamic";


export default async function AttendancePage() {
  const { employee } = await requireEmployee();
  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const records = await prisma.attendanceRecord.findMany({ where: { employeeId: employee.id, workDate: { gte: monthStart } }, orderBy: { workDate: 'desc' }, take: 62 });
  const todayRecord = records.find(r => r.workDate >= today);
  const hours = records.reduce((s,r)=> r.checkIn && r.checkOut ? s + Math.max(0,(r.checkOut.getTime()-r.checkIn.getTime())/36e5) : s, 0);
  const late = records.filter(r=>r.status==='LATE').length;
  const overtime = await prisma.overtimeRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: 'desc' }, take: 20 }).catch(()=>[]);
  const stats = [ ['دخول اليوم', todayRecord?.checkIn?.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) ?? '—', Clock], ['خروج اليوم', todayRecord?.checkOut?.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) ?? '—', Clock], ['ساعات العمل', `${Math.round(hours)} ساعة`, Timer], ['التأخير', `${late} يوم`, AlertTriangle], ['العمل الإضافي', `${overtime.reduce((s,o)=>s+Number(o.hours||0),0)} ساعة`, TrendingUp] ] as const;
  return <main className="space-y-6" dir="rtl"><div><h1 className="text-3xl font-black">الحضور والانصراف</h1><p className="text-muted-foreground">متابعة الدوام الشهري وتقويم الحضور.</p></div><EmployeeMobileAttendancePunch /><section className="grid gap-4 md:grid-cols-5">{stats.map(([t,v,I])=><Card key={t} className="rounded-3xl"><CardContent className="p-5"><I className="h-5 w-5 text-primary"/><p className="mt-3 text-sm text-muted-foreground">{t}</p><p className="text-xl font-black">{v}</p></CardContent></Card>)}</section><Card className="rounded-3xl"><CardHeader><CardTitle>الجدول الشهري</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الدخول</th><th className="p-3 text-right">الخروج</th><th className="p-3 text-right">الحالة</th></tr></thead><tbody>{records.map(r=><tr key={r.id} className="border-b"><td className="p-3">{fmtDate(r.workDate)}</td><td className="p-3">{r.checkIn?.toLocaleTimeString('ar-SA')??'—'}</td><td className="p-3">{r.checkOut?.toLocaleTimeString('ar-SA')??'—'}</td><td className="p-3">{r.status}</td></tr>)}</tbody></table></div></CardContent></Card><Card className="rounded-3xl"><CardHeader><CardTitle>الرسم البياني</CardTitle></CardHeader><CardContent><div className="flex h-48 items-end gap-2">{records.slice(0,31).reverse().map(r=><div key={r.id} title={fmtDate(r.workDate)} className="flex-1 rounded-t bg-primary" style={{height: r.status==='ABSENT'?'20%':r.status==='LATE'?'55%':'85%'}} />)}</div></CardContent></Card></main>;
}
