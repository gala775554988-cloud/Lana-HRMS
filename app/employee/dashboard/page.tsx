import Link from 'next/link';
import { Bell, Briefcase, Calendar, CheckCircle2, Clock, FileText, IdCard, Laptop, MapPin, ShieldCheck, User, WalletCards } from 'lucide-react';
import { requireEmployee, getPortalDashboard, profileCompletion, fmtDate, asNumber } from '@/lib/employee/portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeRequestCategories } from '@/components/employee/EmployeeRequestCategories';

export const dynamic = "force-dynamic";


function Stat({ title, value, icon: Icon, tone }: { title: string; value: string | number; icon: any; tone: string }) {
  return <Card className="overflow-hidden rounded-3xl border-0 bg-white/90 shadow-sm dark:bg-slate-900/80"><CardContent className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-black">{value}</p></div><div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" /></div></div></CardContent></Card>;
}

function DiagnosticConfessionBox({ err, location }: { err: any; location: string }) {
  const errMsg = err?.message || String(err || "Unknown error");
  const stack = err?.stack || "";
  return (
    <div className="rounded-3xl border border-rose-300 bg-rose-50/95 p-6 shadow-xl dark:border-rose-800 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100" dir="rtl">
      <h2 className="text-lg font-black">اعتراف النظام بالخطأ التقني المباشر (`{location}`)</h2>
      <p className="font-mono text-xs p-3 bg-white dark:bg-slate-900 rounded-xl mt-2 text-rose-600">{errMsg}</p>
      {stack ? <pre className="font-mono text-[11px] p-3 bg-slate-100 dark:bg-slate-950 rounded-xl mt-2 overflow-auto max-h-64">{stack}</pre> : null}
    </div>
  );
}

export default async function EmployeeDashboard() {
  try {
    const { employee, session } = await requireEmployee();
    const data = await getPortalDashboard(employee.id, session.user.id);
    const completion = profileCompletion(employee);
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    const nextSalary = data.payroll ? `${asNumber(data.payroll.netPay || data.payroll.baseSalary).toLocaleString('ar-SA')} ${data.payroll.currency}` : 'غير مسجل';
    return (
      <main className="space-y-6" dir="rtl">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-violet-700 to-slate-950 text-white shadow-2xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_.8fr] lg:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="h-28 w-28 overflow-hidden rounded-3xl bg-white/15 ring-4 ring-white/20">
              {employee.profilePhotoUrl ? <img src={employee.profilePhotoUrl} alt={fullName} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-4xl font-black">{employee.firstName?.[0]}{employee.lastName?.[0]}</div>}
            </div>
            <div className="min-w-0 space-y-3">
              <div><p className="text-sm text-primary/12">مرحباً بك</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">{fullName}</h1></div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge className="bg-white/15 text-white hover:bg-white/20"><IdCard className="ml-1 h-3.5 w-3.5" />{employee.employeeNumber}</Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/20">هوية: {employee.nationalId}</Badge>
                <Badge className="bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30">{employee.status}</Badge>
              </div>
              <div className="grid gap-2 text-sm text-primary/8 sm:grid-cols-2">
                <span className="flex items-center gap-2"><Briefcase className="h-4 w-4" />{employee.position?.title ?? 'غير محدد'}</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{employee.department?.name ?? 'لا يوجد قسم'}</span>
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{employee.branch?.name ?? 'لا يوجد فرع'}</span>
                <span className="flex items-center gap-2"><User className="h-4 w-4" />المدير: {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : 'غير محدد'}</span>
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center justify-between"><span>اكتمال الملف</span><span className="text-2xl font-black">{completion}%</span></div>
            <div className="mt-3 h-3 rounded-full bg-white/15"><div className="h-3 rounded-full bg-emerald-300" style={{ width: `${completion}%` }} /></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-3"><p className="text-primary/12">حالة الحساب</p><p className="font-bold">{employee.user?.isActive ? 'نشط' : 'غير نشط'}</p></div>
              <div className="rounded-2xl bg-white/10 p-3"><p className="text-primary/12">آخر دخول</p><p className="font-bold">{employee.user?.lastLoginAt ? fmtDate(employee.user.lastLoginAt) : 'لم يسجل'}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          title="رصيد الإجازات"
          value={`${data.leaveRemaining < 0 ? `-${Math.abs(data.leaveRemaining)}` : data.leaveRemaining} يوم`}
          icon={Calendar}
          tone={data.leaveRemaining < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}
        />
        <Stat title="الطلبات المعلقة" value={data.leaves.filter(l => l.status === 'PENDING').length} icon={Clock} tone="bg-amber-50 text-amber-700" />
        <Stat title="الحضور هذا الشهر" value={`${data.presentDays} يوم`} icon={CheckCircle2} tone="bg-blue-50 text-blue-700" />
        <Stat title="ساعات العمل" value={`${Math.round(data.monthHours)} ساعة`} icon={Clock} tone="bg-violet-50 text-violet-700" />
        <Stat title="الراتب القادم" value={nextSalary} icon={WalletCards} tone="bg-primary/8 text-primary" />
        <Stat title="المستندات" value={data.documents} icon={FileText} tone="bg-sky-50 text-sky-700" />
        <Stat title="العهد" value={data.assets} icon={Laptop} tone="bg-slate-100 text-slate-700" />
        <Stat title="الإشعارات الجديدة" value={data.notifications.length} icon={Bell} tone="bg-rose-50 text-rose-700" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-3xl"><CardHeader><CardTitle>Timeline آخر الأحداث</CardTitle></CardHeader><CardContent className="space-y-3">{data.timeline.length ? data.timeline.map((item, i) => <div key={i} className="flex gap-3 rounded-2xl border p-4"><div className="mt-1 h-3 w-3 rounded-full bg-primary" /><div><p className="font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{item.type} · {fmtDate(item.date)} · {item.status}</p></div></div>) : <div className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد أحداث حديثة مرتبطة بحسابك.</div>}</CardContent></Card>
        <Card className="rounded-3xl"><CardHeader><CardTitle>إجراءات سريعة</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3"><Link className="flex items-center justify-center rounded-2xl bg-primary px-3 py-4 text-center text-sm font-bold text-white transition-colors hover:bg-primary" href="/employee/leave/new">طلب إجازة</Link><Link className="flex items-center justify-center rounded-2xl border px-3 py-4 text-center text-sm font-bold transition-colors hover:bg-muted" href="/employee/documents">مستنداتي</Link><Link className="col-span-2 flex items-center justify-center rounded-2xl border px-3 py-4 text-center text-sm font-bold transition-colors hover:bg-muted" href="/employee/salary">الرواتب</Link></CardContent></Card>
      </section>

      <EmployeeRequestCategories />
    </main>
  );
  } catch (err: any) {
    console.error("[EmployeeDashboard][FATAL_ERROR] Stack trace:", err?.stack || err);
    return <DiagnosticConfessionBox err={err} location="EmployeeDashboard (/employee/dashboard)" />;
  }
}
