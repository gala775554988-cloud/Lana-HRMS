import { Suspense } from "react";
import { Activity, CalendarCheck2, FileText, Hospital, Smartphone, Users, WalletCards } from "lucide-react";
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
    <section className="relative hidden min-h-screen overflow-hidden bg-[#030C1B] p-8 text-white lg:flex lg:flex-col lg:justify-between" dir="rtl">
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute -right-24 top-[-10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[150px]" />
      <div className="absolute -bottom-28 left-16 h-80 w-80 rounded-full bg-slate-800/20 blur-[120px]" />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-6">
        <BrandLogo href="/login" size="md" subtitle="Enterprise Human Resource Platform" textClassName="text-white" subtitleClassName="text-white/65" logoClassName="border-white/25 shadow-xl shadow-black/30" />
        <span className="rounded-full border border-slate-800/60 bg-slate-900/50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 backdrop-blur-sm">Modern HR Enterprise</span>
      </div>
      <div className="relative z-10 mx-auto my-auto w-full max-w-5xl space-y-8">
        <div className="grid items-center gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="max-w-2xl space-y-6">
            <h2 className="text-5xl font-black leading-[1.3] tracking-tight xl:text-6xl">
              إدارة الموارد البشرية
              <span className="block bg-gradient-to-l from-primary to-emerald-300 bg-clip-text font-black text-transparent">بطريقة ذكية ومنصة واحدة.</span>
            </h2>
            <p className="max-w-xl text-base font-light leading-relaxed text-slate-400/90 xl:text-lg">نظام متكامل لإدارة الموظفين، الحضور، الإجازات، الرواتب، الأوفر تايم، العهد، الموافقات، والتقارير داخل منصة واحدة موحدة.</p>
          </div>
          <div className="relative min-h-[520px]">
            <div className="absolute inset-x-0 top-12 h-[28rem] rounded-[4rem] bg-primary/10 blur-3xl" />
            <div className="absolute left-1/2 top-5 z-20 h-[500px] w-[250px] -translate-x-1/2 rounded-[3rem] border border-white/10 bg-[#030C1B] p-3 shadow-2xl shadow-black/40 [animation:phoneFloat_7s_ease-in-out_infinite]">
              <div className="h-full overflow-hidden rounded-[2.35rem] bg-[#F7F9FC] p-4 text-[#111827]">
                <div className="mx-auto mb-4 h-6 w-28 rounded-b-2xl bg-[#030C1B]" />
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#64748B]">Lana HRMS</p><h3 className="text-xl font-black text-[#0B192B]">{phoneSlides[0]}</h3></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white"><Smartphone className="h-5 w-5" /></div></div>
                <div className="mt-5 rounded-3xl bg-gradient-to-br from-primary to-[#028090] p-5 text-white shadow-xl"><p className="text-sm text-white/70">Mobile demo</p><div className="mt-4 text-5xl font-black">360°</div><div className="mt-5 space-y-2">{phoneSlides.slice(0, 3).map((item) => <div key={item} className="rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">{item}</div>)}</div></div>
                <div className="mt-4 grid grid-cols-2 gap-3">{phoneSlides.slice(2).map((item, index) => (<div key={item} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm"><div className="mb-2 h-2 w-10 rounded-full bg-primary/20" /><p className="text-[10px] font-bold text-[#64748B]">{item}</p><p className="mt-1 text-lg font-black text-[#0B192B]">{(index + 2) * 8}</p></div>))}</div>
              </div>
            </div>
            {["✓ طلب جديد","✓ تمت الموافقة","✓ راتب جاهز","✓ إشعار جديد","✓ حضور اليوم","✓ ساعات إضافية"].map((label, index) => (<div key={label} className={`absolute z-30 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur-xl ${index % 2 ? "left-4" : "right-4"}`} style={{ top: `${14 + index * 13}%`, animation: `phoneFloat ${6 + index}s ${index * 0.35}s ease-in-out infinite` }}>{label}</div>))}
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-3 gap-8 border-t border-slate-800/60 pt-8 backdrop-blur-sm xl:grid-cols-6">
        {stats.map((stat, index) => (
          <div key={stat.label} style={{ animation: `lanaSlideUp 520ms ${index * 65}ms ease both` }}>
            <span className="block text-2xl font-bold text-white">{stat.value}</span>
            <span className="block text-[11px] font-medium text-slate-500">{stat.label}</span>
          </div>
        ))}
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
        <div className="mb-7 flex flex-col items-center text-center lg:items-start lg:text-start">
          <div className="flex items-center gap-3">
            <BrandLogo href="/" size="hero" showText={false} logoClassName="border-slate-300 shadow-2xl shadow-primary/10 ring-4 ring-white/80 dark:border-slate-700 dark:ring-slate-800" imageClassName="p-2" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">Lana <span className="font-medium text-primary">HRMS</span></h1>
          </div>
          <p className="mt-3 text-sm font-medium text-slate-400 dark:text-slate-500">البوابة الموحدة لدخول الموظفين والمسؤولين</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <Suspense><LoginForm dictionary={dictionary} /></Suspense>
        </div>
      </div>
    </section>
  );
  return (<main className="min-h-screen bg-slate-50 dark:bg-slate-950" dir="ltr"><div className="grid min-h-screen lg:grid-cols-[65fr_35fr]">{isAr ? (<><MarketingPanel />{loginPanel}</>) : (<>{loginPanel}<MarketingPanel /></>)}</div></main>);
}
