import Link from 'next/link';
import Image from 'next/image';
import { Bell, Briefcase, Calendar, CheckCircle2, Clock, FileText, IdCard, Laptop, MapPin, ShieldCheck, User, WalletCards } from 'lucide-react';
import { requireEmployee, getPortalDashboard, profileCompletion, fmtDate, asNumber } from '@/lib/employee/portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeRequestCategories } from '@/components/employee/EmployeeRequestCategories';

export const dynamic = "force-dynamic";


function Stat({ title, value, icon: Icon, tone }: { title: string; value: string | number; icon: any; tone: string }) {
  return <Card className="overflow-hidden border-border bg-card"><CardContent className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

export default async function EmployeeDashboard() {
  try {
    const { employee, session } = await requireEmployee();
    const data = await getPortalDashboard(employee.id, session.user.id);
    const completion = profileCompletion(employee);
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    const maskedNationalId = employee.nationalId ? `•••• ${employee.nationalId.slice(-4)}` : "غير مسجلة";
    const lastPaidSalary = data.payroll ? `${asNumber(data.payroll.netPay).toLocaleString('ar-SA')} ${data.payroll.currency}` : 'غير مسجل';
    return (
      <main className="space-y-6" dir="rtl">
      <section className="lana-workspace-hero employee-profile-hero overflow-hidden rounded-3xl shadow-[var(--shadow-card)]">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] lg:p-8">
          <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center">
            <div className="employee-profile-avatar h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 sm:h-24 sm:w-24">
              {employee.profilePhotoUrl ? <Image src={employee.profilePhotoUrl} alt={fullName} width={96} height={96} unoptimized className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-3xl font-bold">{employee.firstName?.[0]}{employee.lastName?.[0]}</div>}
            </div>
            <div className="min-w-0 space-y-3">
              <div><p className="employee-profile-secondary text-sm font-medium">مرحباً بك</p><h1 className="employee-profile-name break-words text-2xl font-bold leading-snug sm:text-3xl md:text-4xl">{fullName}</h1></div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge className="employee-profile-badge"><IdCard className="ml-1 h-3.5 w-3.5" />{employee.employeeNumber}</Badge>
                <Badge className="employee-profile-badge">الهوية: {maskedNationalId}</Badge>
                <Badge className={`employee-profile-badge ${employee.status === "ACTIVE" ? "employee-profile-active" : ""}`}>{employee.status === "ACTIVE" ? "نشط" : employee.status}</Badge>
              </div>
              <div className="employee-profile-secondary grid gap-3 text-sm sm:grid-cols-2">
                <span className="flex min-w-0 items-start gap-2"><Briefcase className="mt-1 h-4 w-4 shrink-0" />{employee.position?.title ?? 'غير محدد'}</span>
                <span className="flex min-w-0 items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0" />{employee.department?.name ?? 'لا يوجد قسم'}</span>
                <span className="flex min-w-0 items-start gap-2"><MapPin className="mt-1 h-4 w-4 shrink-0" />{employee.branch?.name ?? 'لا يوجد فرع'}</span>
                <span className="flex min-w-0 items-start gap-2"><User className="mt-1 h-4 w-4 shrink-0" />المدير: {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : 'غير محدد'}</span>
              </div>
            </div>
          </div>
          <div className="employee-profile-panel min-w-0 rounded-2xl border p-4 sm:p-5">
            <div className="flex items-center justify-between"><span>اكتمال الملف</span><span className="text-2xl font-bold">{completion}%</span></div>
            <div className="employee-profile-track mt-3 h-3 overflow-hidden rounded-full"><div className="employee-profile-fill h-3 rounded-full" style={{ width: `${completion}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:gap-3">
              <div className="employee-profile-detail min-w-0 rounded-xl border p-3"><p className="employee-profile-secondary">حالة الحساب</p><p className="font-bold">{employee.user?.isActive ? 'نشط' : 'غير نشط'}</p></div>
              <div className="employee-profile-detail min-w-0 rounded-xl border p-3"><p className="employee-profile-secondary">آخر دخول</p><p className="font-bold">{employee.user?.lastLoginAt ? fmtDate(employee.user.lastLoginAt) : 'لم يسجل'}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          title="رصيد الإجازات"
          value={data.leaveRemaining === null ? "غير متاح حاليًا" : `${data.leaveRemaining} يوم`}
          icon={Calendar}
          tone={(data.leaveRemaining ?? 0) < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}
        />
        <Stat title="الطلبات المعلقة" value={data.pendingRequests ?? "—"} icon={Clock} tone="bg-amber-50 text-amber-700" />
        <Stat title="الحضور هذا الشهر" value={`${data.presentDays} يوم`} icon={CheckCircle2} tone="bg-blue-50 text-blue-700" />
        <Stat title="ساعات العمل" value={`${Math.round(data.monthHours)} ساعة`} icon={Clock} tone="bg-violet-50 text-violet-700" />
        <Stat title="آخر راتب مصروف" value={lastPaidSalary} icon={WalletCards} tone="bg-primary/8 text-primary" />
        <Stat title="المستندات" value={data.documents} icon={FileText} tone="bg-sky-50 text-sky-700" />
        <Stat title="العهد" value={data.assets} icon={Laptop} tone="bg-slate-100 text-slate-700" />
        <Stat title="الإشعارات الجديدة" value={data.notifications.length} icon={Bell} tone="bg-rose-50 text-rose-700" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-3xl"><CardHeader><CardTitle>آخر الأحداث</CardTitle></CardHeader><CardContent className="space-y-3">{data.timeline.length ? data.timeline.map((item, i) => <div key={i} className="flex gap-3 rounded-2xl border p-4"><div className="mt-1 h-3 w-3 rounded-full bg-primary" /><div><p className="font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{item.type} · {fmtDate(item.date)} · {item.status}</p></div></div>) : <div className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد أحداث حديثة مرتبطة بحسابك.</div>}</CardContent></Card>
        <Card className="rounded-3xl"><CardHeader><CardTitle>إجراءات سريعة</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3"><Link className="flex items-center justify-center rounded-2xl bg-primary px-3 py-4 text-center text-sm font-bold text-white transition-colors hover:bg-primary/90" href="/employee/requests">تقديم طلب</Link><Link className="flex items-center justify-center rounded-2xl border px-3 py-4 text-center text-sm font-bold transition-colors hover:bg-muted" href="/employee/documents">مستنداتي</Link><Link className="col-span-2 flex items-center justify-center rounded-2xl border px-3 py-4 text-center text-sm font-bold transition-colors hover:bg-muted" href="/employee/salary">الرواتب</Link></CardContent></Card>
      </section>

      <EmployeeRequestCategories />
    </main>
  );
  } catch (err: any) {
    console.error("[EmployeeDashboard] render failed", err);
    throw err;
  }
}
