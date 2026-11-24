import Link from "next/link";
import { LoginCard } from "@/components/auth/login-card";
import { ArrowLeft, ArrowRight, BarChart3, CalendarCheck2, CheckCircle2, Fingerprint, ShieldCheck, Users, WalletCards } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { getDirection, type Locale, type Dictionary } from "@/lib/i18n";

const content = {
  ar: {
    eyebrow: "شريكك في إدارة الموارد البشرية",
    title: "كل ما يحتاجه فريقك،",
    subtitle: "إدارة الموظفين والحضور والإجازات والرواتب والموافقات بواجهة عربية واضحة وآمنة.",
    signIn: "تسجيل الدخول", explore: "اكتشف مدار",
    panelTitle: "أعمال أوضح. فرق أقرب.",
    panelText: "تابع مؤشرات القوى العاملة والطلبات والالتزام من لوحة واحدة، مع صلاحيات دقيقة لكل مستخدم.",
    featuresTitle: "مصمم للعمل اليومي",
    features: [
      { icon: Users, title: "ملفات الموظفين", text: "بيانات وعقود ومستندات منظمة وسهلة الوصول." },
      { icon: CalendarCheck2, title: "الحضور والإجازات", text: "متابعة الحضور والورديات والطلبات ومسارات اعتمادها." },
      { icon: WalletCards, title: "الرواتب والمزايا", text: "إدارة المسيرات والبدلات والاستقطاعات بمراجعة واضحة." },
      { icon: Fingerprint, title: "البصمة والمواقع", text: "ربط الحركات بالمواقع ومتابعة الاستثناءات والتأخير." },
      { icon: BarChart3, title: "التقارير والتحليلات", text: "مؤشرات قابلة للمتابعة تساعد الإدارة على اتخاذ القرار." },
      { icon: ShieldCheck, title: "الصلاحيات والتدقيق", text: "تحكم دقيق بالوصول وسجل موثوق للعمليات الحساسة." }
    ],
    footer: "نظام إدارة الموارد البشرية"
  },
  en: {
    eyebrow: "Integrated HR platform", title: "Your entire workforce operation in one system.",
    subtitle: "Manage people, attendance, leave, payroll, and approvals through a clear and secure experience.",
    signIn: "Sign in", explore: "Explore the platform", panelTitle: "One operational view",
    panelText: "Track workforce indicators, requests, and compliance from one dashboard with precise access controls.",
    featuresTitle: "Built for everyday work",
    features: [
      { icon: Users, title: "Employee records", text: "Organized employee data, contracts, and documents." },
      { icon: CalendarCheck2, title: "Attendance and leave", text: "Track shifts, attendance, requests, and approvals." },
      { icon: WalletCards, title: "Payroll and benefits", text: "Review payroll, allowances, and deductions clearly." },
      { icon: Fingerprint, title: "Biometrics and sites", text: "Connect punches to sites and review exceptions." },
      { icon: BarChart3, title: "Reports and analytics", text: "Actionable indicators for better decisions." },
      { icon: ShieldCheck, title: "Access and audit", text: "Granular permissions and a reliable audit trail." }
    ],
    footer: "Human Resources Management System"
  }
} as const;

export function LandingPage({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const isAr = locale === "ar";
  const t = content[isAr ? "ar" : "en"];
  const NextIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <main dir={getDirection(locale)} className="min-h-screen bg-[#132b28] text-[#f3f3eb]">
      <header className="border-b border-[#405b50] bg-[#132b28]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <BrandLogo size="sm" subtitle="MADAR HR" />
          <div className="flex items-center gap-2">
            <ClientLanguageToggle variant="ghost" />
            <a href="#sign-in" className="inline-flex h-10 items-center rounded-lg bg-[#c6e39a] px-5 text-sm font-semibold text-[#132b28] transition-colors hover:bg-[#b5d58b]">{t.signIn}</a>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div>
          <span className="inline-flex rounded-full border border-[#56705d] px-3 py-1 text-sm font-semibold text-[#c6e39a]">{t.eyebrow}</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">{t.title}{isAr && <span className="block text-[#c6e39a]">في مدار واحد.</span>}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#b3c6bb]">{t.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#sign-in" className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#c6e39a] px-6 text-sm font-semibold text-[#132b28] transition-colors hover:bg-[#b5d58b]">{t.signIn}<NextIcon className="h-4 w-4" /></a>
            <Link href="/careers" className="inline-flex h-12 items-center rounded-lg bg-[#1c3932] px-6 text-sm font-semibold text-[#f3f3eb]">التقديم على وظيفة</Link>
            <a href="#features" className="inline-flex h-12 items-center rounded-lg border border-[#56705d] bg-transparent px-6 text-sm font-semibold text-[#f3f3eb] transition-colors hover:border-primary/40 hover:text-primary">{t.explore}</a>
          </div>
        </div>

        <div id="sign-in" className="scroll-mt-6 rounded-3xl bg-[#f3f3eb] p-5 text-[#132b28] sm:p-8"><div className="mx-auto max-w-md"><LoginCard dictionary={dictionary} /></div></div>
        <div className="lg:col-span-2 rounded-3xl border border-[#405b50] bg-[#1c3932] p-5 shadow-2xl shadow-slate-900/15 sm:p-8">
          <div className="rounded-2xl bg-[#f3f3eb] p-6 text-[#132b28]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5"><BrandLogo size="sm" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="online" /></div>
            <h2 className="mt-6 text-xl font-bold">{t.panelTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t.panelText}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {t.features.slice(0, 4).map((feature) => (
                <div key={feature.title} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e4ebd4] text-primary"><feature.icon className="h-4 w-4" /></span>
                  <span className="text-sm font-semibold">{feature.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-[#405b50] bg-[#f3f3eb] py-16 text-[#132b28]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight">{t.featuresTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 p-6">
                <feature.icon className="h-6 w-6 text-primary" /><h3 className="mt-5 font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p><CheckCircle2 className="mt-5 h-4 w-4 text-emerald-600" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#132b28] py-8 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="font-bold text-white">MADAR HR</span><span className="text-sm">{t.footer}</span></div>
      </footer>
    </main>
  );
}
