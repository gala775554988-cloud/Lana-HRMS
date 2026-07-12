import { Suspense } from "react";
import { Activity, Building2, CalendarCheck2, CheckCircle2, Clock3, FileText, Hospital, Smartphone, Users, WalletCards } from "lucide-react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { LoginForm } from "./login-form";

const stats = [
  { label: "عدد الموظفين", value: "4580", icon: Users },
  { label: "عدد المستشفيات", value: "72", icon: Hospital },
  { label: "الطلبات الجديدة", value: "15", icon: FileText },
  { label: "الرواتب", value: "98%", icon: WalletCards },
  { label: "الأوفر تايم", value: "124h", icon: Activity },
  { label: "الإجازات", value: "32", icon: CalendarCheck2 }
];

const phoneSlides = ["Dashboard", "Employees", "Attendance", "Leaves", "Payroll", "Overtime"];

function MarketingPanel() {
  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-[linear-gradient(135deg,#081B46_0%,#182B72_45%,#1E4F78_70%,#274F86_100%)] p-8 text-white lg:flex lg:flex-col lg:justify-center" dir="rtl">
      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute -right-24 top-16 h-72 w-72 rounded-full bg-[#3F46E8]/30 blur-3xl" />
      <div className="absolute -bottom-28 left-16 h-80 w-80 rounded-full bg-[#6D6AF8]/20 blur-3xl" />
      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-6">
          <BrandLogo href="/login" size="md" subtitle="Enterprise Human Resource Platform" textClassName="text-white" subtitleClassName="text-white/65" logoClassName="border-white/25 shadow-xl shadow-[#081B46]/30" />
          <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white/85 backdrop-blur">Modern HR Platform</span>
        </div>
        <div className="grid items-center gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <h2 className="text-5xl font-black leading-tight tracking-tight xl:text-6xl">إدارة الموارد البشرية<span className="block text-white/90">بطريقة ذكية</span><span className="block text-white/80">ومنصة واحدة.</span></h2>
            <p className="max-w-xl text-base leading-8 text-white/70 xl:text-lg">نظام متكامل لإدارة الموظفين، الحضور، الإجازات، الرواتب، الأوفر تايم، العهد، الموافقات، والتقارير داخل منصة واحدة موحدة.</p>
          </div>
          <div className="relative min-h-[520px]">
            <div className="absolute inset-x-0 top-12 h-[28rem] rounded-[4rem] bg-white/10 blur-3xl" />
            <div className="absolute left-1/2 top-5 z-20 h-[500px] w-[250px] -translate-x-1/2 rounded-[3rem] border border-white/40 bg-[#081B46] p-3 shadow-2xl shadow-[#081B46]/40 [animation:phoneFloat_7s_ease-in-out_infinite]">
              <div className="h-full overflow-hidden rounded-[2.35rem] bg-[#F7F9FC] p-4 text-[#111827]">
                <div className="mx-auto mb-4 h-6 w-28 rounded-b-2xl bg-[#081B46]" />
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#64748B]">Lana HRMS</p><h3 className="text-xl font-black text-[#262B63]">{phoneSlides[0]}</h3></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#3F46E8] text-white"><Smartphone className="h-5 w-5" /></div></div>
                <div className="mt-5 rounded-3xl bg-gradient-to-br from-[#3F46E8] to-[#262B63] p-5 text-white shadow-xl"><p className="text-sm text-white/70">Mobile demo</p><div className="mt-4 text-5xl font-black">360°</div><div className="mt-5 space-y-2">{phoneSlides.slice(0, 3).map((item) => <div key={item} className="rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">{item}</div>)}</div></div>
                <div className="mt-4 grid grid-cols-2 gap-3">{phoneSlides.slice(2).map((item, index) => (<div key={item} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm"><div className="mb-2 h-2 w-10 rounded-full bg-[#3F46E8]/20" /><p className="text-[10px] font-bold text-[#64748B]">{item}</p><p className="mt-1 text-lg font-black text-[#262B63]">{(index + 2) * 8}</p></div>))}</div>
              </div>
            </div>
            {["✓ طلب جديد","✓ تمت الموافقة","✓ راتب جاهز","✓ إشعار جديد","✓ حضور اليوم","✓ ساعات إضافية"].map((label, index) => (<div key={label} className={`absolute z-30 rounded-2xl border border-white/25 bg-white/12 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur-xl ${index % 2 ? "left-4" : "right-4"}`} style={{ top: `${14 + index * 13}%`, animation: `phoneFloat ${6 + index}s ${index * 0.35}s ease-in-out infinite` }}>{label}</div>))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{stats.map((stat, index) => { const Icon = stat.icon; return (<div key={stat.label} className="rounded-3xl border border-white/20 bg-white/10 p-4 shadow-xl shadow-[#081B46]/15 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:bg-white/15" style={{ animation: `lanaSlideUp 520ms ${index * 65}ms ease both` }}><div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-white/15"><Icon className="h-5 w-5" /></div><p className="text-2xl font-black">{stat.value}</p><p className="mt-1 text-xs font-bold text-white/65">{stat.label}</p></div>); })}</div>
      </div>
    </section>
  );
}

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary();
  const isAr = locale === "ar";
  const loginPanel = (
    <section className="relative flex min-h-screen items-center justify-center bg-slate-50/90 p-6 dark:bg-slate-950" dir={isAr ? "rtl" : "ltr"}>
      <div className="absolute end-4 top-4"><ClientLanguageToggle variant="outline" /></div>
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandLogo href="/" size="hero" showText={false} logoClassName="border-slate-300 shadow-2xl shadow-indigo-950/20 ring-4 ring-white/80 dark:border-slate-700 dark:ring-slate-800" imageClassName="p-2" />
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-4xl">Lana HRMS</h1>
          <p className="mt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">البوابة الموحدة لدخول الموظفين والمسؤولين</p>
        </div>
        <div className="bg-white/95 dark:bg-slate-900/90 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-8 backdrop-blur">
          <Suspense><LoginForm dictionary={dictionary} /></Suspense>
        </div>
      </div>
    </section>
  );
  return (<main className="min-h-screen bg-slate-50 dark:bg-slate-950" dir="ltr"><div className="grid min-h-screen lg:grid-cols-[65fr_35fr]">{isAr ? (<><MarketingPanel />{loginPanel}</>) : (<>{loginPanel}<MarketingPanel /></>)}</div></main>);
}
