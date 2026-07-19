import { Activity, CalendarCheck2, FileText, Hospital, Smartphone, Users, WalletCards, LayoutGrid, Monitor, Video, ShieldCheck } from "lucide-react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { LoginCard } from "@/components/auth/login-card";

export const dynamic = "force-dynamic";

const stats = [
  { label: "عدد الموظفين", value: "4580", icon: Users },
  { label: "عدد المستشفيات", value: "72", icon: Hospital },
  { label: "الطلبات الجديدة", value: "15", icon: FileText },
  { label: "الرواتب", value: "98%", icon: WalletCards },
  { label: "الأوفر تايم", value: "124h", icon: Activity },
  { label: "الإجازات", value: "32", icon: CalendarCheck2 }
];

const phoneSlides = ["Dashboard", "Employees", "Attendance", "Leaves", "Payroll", "Overtime"];

const PHONE_VIDEO_POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2ED3C6"/>
        <stop offset="100%" stop-color="#19BFAF"/>
      </linearGradient>
    </defs>
    <rect width="400" height="220" fill="url(#g)"/>
    <circle cx="200" cy="100" r="28" fill="rgba(255,255,255,0.2)"/>
    <circle cx="200" cy="100" r="19" fill="#ffffff"/>
    <path d="M193 89 L213 100 L193 111 Z" fill="#19BFAF"/>
    <text x="200" y="155" font-family="Cairo, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">لانا الطبية</text>
  </svg>`
)}`;

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
            <div className="absolute left-1/2 top-5 z-20 h-[520px] w-[270px] -translate-x-1/2 rounded-[3rem] border border-white/10 bg-[#030C1B] p-3 shadow-2xl shadow-black/40 [animation:phoneFloat_7s_ease-in-out_infinite]">
              <div className="h-full overflow-y-auto overflow-x-hidden rounded-[2.35rem] bg-[#F7F9FC] p-3.5 text-[#111827] space-y-3 text-start">
                <div className="mx-auto mb-2 h-5 w-28 rounded-b-2xl bg-[#030C1B]" />
                
                {/* Miniature Web Platform Header with Key Metrics */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Monitor className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-[11px] font-black text-[#0B192B] truncate">Lana HR Platform Web</span>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                    Enterprise
                  </span>
                </div>

                {/* Retained Data Widgets in Web Grid */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-gradient-to-br from-primary to-[#19BFAF] p-2 text-white shadow-xs">
                    <p className="text-[9px] font-medium text-white/80">Platform</p>
                    <p className="text-sm font-black mt-0.5">360°</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
                    <p className="text-[9px] font-bold text-slate-500">الإجازات</p>
                    <p className="text-sm font-black text-primary mt-0.5">24</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
                    <p className="text-[9px] font-bold text-slate-500">الحضور</p>
                    <p className="text-sm font-black text-emerald-600 mt-0.5">16</p>
                  </div>
                </div>

                {/* Prominent Video Player Container (Lana Medical Walkthrough) */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md group relative">
                  <div className="flex items-center justify-between bg-slate-950/90 px-2.5 py-1.5 text-[9px] text-slate-300 border-b border-slate-800">
                    <span className="font-bold flex items-center gap-1 truncate text-amber-300">
                      <Video className="h-3 w-3 shrink-0" />
                      Lana Medical Walkthrough Video
                    </span>
                    <span className="font-mono text-[8px] text-slate-400">02:45</span>
                  </div>
                  <video
                    className="h-28 w-full bg-slate-900 object-cover"
                    controls
                    playsInline
                    preload="none"
                    poster={PHONE_VIDEO_POSTER}
                  >
                    <source src="/lana-intro.mp4" type="video/mp4" />
                  </video>
                </div>

                {/* 2-Column Grid of UI Screenshot Modules */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-700 border-b border-slate-100 pb-1">
                      <LayoutGrid className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">Team Collaboration</span>
                    </div>
                    <div className="h-12 rounded-lg bg-primary/60 border border-primary/60 p-1.5 flex flex-col justify-between text-[8px] text-primary font-medium">
                      <div className="flex justify-between items-center"><span className="truncate font-bold">Shift Schedule</span><span className="text-primary">Active</span></div>
                      <div className="h-1.5 w-full rounded-full bg-primary/80"><div className="h-full w-4/5 rounded-full bg-primary" /></div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-700 border-b border-slate-100 pb-1">
                      <Users className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span className="truncate">Org Chart View</span>
                    </div>
                    <div className="h-12 rounded-lg bg-emerald-50/60 border border-emerald-100/60 p-1.5 flex flex-col justify-between text-[8px] text-emerald-900 font-medium">
                      <div className="flex justify-between items-center"><span className="truncate font-bold">Hierarchy Tree</span><span className="text-emerald-600">Live</span></div>
                      <div className="grid grid-cols-3 gap-0.5 pt-1"><div className="h-3 bg-emerald-200/80 rounded-sm" /><div className="h-3 bg-emerald-300 rounded-sm" /><div className="h-3 bg-emerald-200/80 rounded-sm" /></div>
                    </div>
                  </div>
                </div>

                {/* Summary Card below grid */}
                <div className="rounded-xl border border-slate-200 bg-white p-2 text-[9px] flex items-center justify-between shadow-2xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                    Payroll & Medical Workflow Sync
                  </span>
                  <span className="text-emerald-600 font-black">100% Verified</span>
                </div>
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

function DiagnosticConfessionBox({ err, location }: { err: any; location: string }) {
  const errMsg = err?.message || String(err || "Unknown error");
  const stack = err?.stack || "";
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-slate-900 text-rose-100" dir="rtl">
      <div className="max-w-2xl w-full rounded-3xl border border-rose-500/50 bg-rose-950/90 p-6 shadow-2xl">
        <h2 className="text-lg font-black text-rose-300">اعتراف النظام بالخطأ التقني المباشر (`{location}`)</h2>
        <p className="font-mono text-xs p-3 bg-black/60 rounded-xl mt-3 text-rose-400 font-bold select-all">{errMsg}</p>
        {stack ? <pre className="font-mono text-[10px] p-3 bg-black/80 text-slate-300 rounded-xl mt-3 overflow-auto max-h-64 select-all">{stack}</pre> : null}
      </div>
    </div>
  );
}

export default async function LoginPage() {
  try {
    const { locale, dictionary } = await getRequestDictionary().catch(() => ({
      locale: "ar" as const,
      dictionary: {} as any
    }));
    const isAr = locale === "ar";
    const loginPanel = (
      <section className="relative flex min-h-screen items-center justify-center bg-white p-6 dark:bg-slate-950" dir={isAr ? "rtl" : "ltr"}>
        <div className="absolute end-4 top-4"><ClientLanguageToggle variant="outline" /></div>
        <LoginCard dictionary={dictionary} />
      </section>
    );
    return (<main className="min-h-screen bg-white dark:bg-slate-950" dir="ltr"><div className="grid min-h-screen lg:grid-cols-[65fr_35fr]">{isAr ? (<><MarketingPanel />{loginPanel}</>) : (<>{loginPanel}<MarketingPanel /></>)}</div></main>);
  } catch (err: any) {
    return <DiagnosticConfessionBox err={err} location="LoginPage (/login)" />;
  }
}
