import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Hospital,
  WalletCards,
  CalendarCheck2,
  ShieldCheck,
  ClipboardCheck,
  Building2,
  Sparkles,
  BadgeCheck
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { getDirection, type Locale } from "@/lib/i18n";

const VIDEO_POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00A896"/>
        <stop offset="100%" stop-color="#028090"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#g)"/>
    <circle cx="400" cy="230" r="52" fill="rgba(255,255,255,0.2)"/>
    <circle cx="400" cy="230" r="36" fill="#ffffff"/>
    <path d="M389 210 L423 230 L389 250 Z" fill="#00A896"/>
    <text x="400" y="330" font-family="Cairo, sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">لانا الطبية</text>
  </svg>`
)}`;

const copy = {
  ar: {
    tagline: "منصة الموارد البشرية المؤسسية",
    heroTitle: "لانا الطبية",
    heroHighlight: "إدارة موارد بشرية أذكى لقطاع الرعاية الصحية.",
    heroSubtitle:
      "منصة موحدة لإدارة الموظفين، الحضور، الإجازات، الرواتب، العهد، والموافقات عبر جميع فروعك ومستشفياتك — بأداء سريع وأمان على مستوى المؤسسات.",
    ctaPrimary: "تسجيل الدخول",
    ctaSecondary: "استكشف الإمكانيات",
    aboutTitle: "من نحن",
    aboutHeading: "نبذة عن لانا الطبية",
    aboutText:
      "نحن نضع جودة الخدمة ورضا العملاء في المقام الأول. نسعى جاهدين لتقديم خدمات طبية متميزة وموثوقة. يتمتع فريقنا المتخصص وذو الخبرة بالاستعداد التام لتلبية احتياجاتكم وتقديم الدعم اللازم في أي وقت.",
    aboutPoints: ["فريق طبي متخصص وذو خبرة", "دعم متواصل على مدار الساعة", "التزام تام بالجودة والموثوقية"],
    aboutCta: "اقرأ المزيد",
    featuresTitle: "كل ما تحتاجه إدارة الموارد البشرية في مكان واحد",
    featuresSubtitle: "أدوات متكاملة مصممة خصيصًا لمنشآت الرعاية الصحية متعددة الفروع.",
    features: [
      { icon: Users, title: "إدارة الموظفين", desc: "ملفات موظفين شاملة، عقود، ومستندات في مكان واحد." },
      { icon: Hospital, title: "تعدد الفروع والمستشفيات", desc: "إدارة موحدة عبر جميع المنشآت والأقسام الطبية." },
      { icon: CalendarCheck2, title: "الحضور والإجازات", desc: "تتبع الحضور وطلبات الإجازات بسير عمل آلي." },
      { icon: WalletCards, title: "الرواتب والعهد", desc: "احتساب الرواتب والأوفر تايم والعهد بدقة وشفافية." },
      { icon: ClipboardCheck, title: "مسارات الموافقات", desc: "مسارات موافقة ذكية مرتبطة بالهيكل التنظيمي الفعلي." },
      { icon: ShieldCheck, title: "أمان على مستوى المؤسسات", desc: "صلاحيات دقيقة، سجل تدقيق كامل، وحماية من الوصول غير المصرح به." }
    ],
    stats: [
      { label: "موظف", value: "8,000+" },
      { label: "فرع ومستشفى", value: "70+" },
      { label: "وقت التشغيل", value: "99.9%" },
      { label: "أمان البيانات", value: "24/7" }
    ],
    ctaBandTitle: "جاهز لدخول لوحة التحكم؟",
    ctaBandSubtitle: "سجّل الدخول بحسابك للوصول إلى بياناتك ومهامك.",
    ctaBandButton: "الدخول إلى النظام",
    footerRights: "جميع الحقوق محفوظة.",
    footerTagline: "نظام إدارة الموارد البشرية"
  },
  en: {
    tagline: "Enterprise HR Platform",
    heroTitle: "Lana Medical",
    heroHighlight: "Smarter HR management for healthcare organizations.",
    heroSubtitle:
      "A unified platform to manage employees, attendance, leave, payroll, assets, and approvals across every branch and hospital — fast, secure, and built for scale.",
    ctaPrimary: "Sign in",
    ctaSecondary: "Explore features",
    aboutTitle: "About Us",
    aboutHeading: "About Lana Medical",
    aboutText:
      "We put service quality and customer satisfaction first. We strive to deliver outstanding, reliable medical services. Our specialized, experienced team is fully ready to meet your needs and provide the support you need, whenever you need it.",
    aboutPoints: ["A specialized, experienced medical team", "Round-the-clock ongoing support", "Full commitment to quality and reliability"],
    aboutCta: "Read more",
    featuresTitle: "Everything HR needs, in one place",
    featuresSubtitle: "Integrated tools purpose-built for multi-branch healthcare organizations.",
    features: [
      { icon: Users, title: "Employee Management", desc: "Complete employee profiles, contracts, and documents in one place." },
      { icon: Hospital, title: "Multi-Branch & Hospitals", desc: "Unified management across every facility and medical department." },
      { icon: CalendarCheck2, title: "Attendance & Leave", desc: "Track attendance and leave requests with automated workflows." },
      { icon: WalletCards, title: "Payroll & Custody", desc: "Accurate payroll, overtime, and asset custody calculations." },
      { icon: ClipboardCheck, title: "Approval Workflows", desc: "Smart approval paths tied to your real organizational structure." },
      { icon: ShieldCheck, title: "Enterprise-Grade Security", desc: "Granular permissions, full audit trail, and access protection." }
    ],
    stats: [
      { label: "Employees", value: "8,000+" },
      { label: "Branches & Hospitals", value: "70+" },
      { label: "Uptime", value: "99.9%" },
      { label: "Data Security", value: "24/7" }
    ],
    ctaBandTitle: "Ready to access your dashboard?",
    ctaBandSubtitle: "Sign in with your account to reach your data and tasks.",
    ctaBandButton: "Go to the platform",
    footerRights: "All rights reserved.",
    footerTagline: "Human Resource Management System"
  }
} as const;

export function LandingPage({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = copy[isAr ? "ar" : "en"];
  const dir = getDirection(locale);
  const NextIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <main dir={dir} className="min-h-screen overflow-x-hidden bg-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 end-[-10%] h-[520px] w-[520px] rounded-full bg-primary/[0.06] blur-[140px]" />
        <div className="absolute bottom-[-15%] start-[-10%] h-[420px] w-[420px] rounded-full bg-secondary/[0.05] blur-[140px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <BrandLogo size="sm" subtitle={t.footerTagline} />
          <div className="flex items-center gap-2 sm:gap-3">
            <ClientLanguageToggle variant="ghost" className="hidden sm:inline-flex" />
            <HeaderLoginButton ctaPrimary={t.ctaPrimary} />
          </div>
        </div>
      </header>

      <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <span className="animate-in fade-in slide-in-from-bottom-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary duration-500 fill-mode-both">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t.tagline}
          </span>
          <h1 className="animate-in fade-in slide-in-from-bottom-3 mt-6 text-4xl font-extrabold tracking-tight text-slate-900 duration-500 delay-100 fill-mode-both sm:text-5xl lg:text-6xl">
            {t.heroTitle}
          </h1>
          <p className="animate-in fade-in slide-in-from-bottom-3 mt-4 max-w-2xl bg-gradient-to-l from-primary to-secondary bg-clip-text text-xl font-bold text-transparent duration-500 delay-150 fill-mode-both sm:text-2xl">
            {t.heroHighlight}
          </p>
          <p className="animate-in fade-in slide-in-from-bottom-3 mt-5 max-w-2xl text-base leading-relaxed text-slate-500 duration-500 delay-200 fill-mode-both">
            {t.heroSubtitle}
          </p>
          <div className="animate-in fade-in slide-in-from-bottom-3 mt-8 flex flex-col items-center gap-3 duration-500 delay-300 fill-mode-both sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
            >
              {t.ctaPrimary}
              <NextIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 text-sm font-bold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary active:scale-95"
            >
              {t.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 duration-500 delay-500 fill-mode-both sm:grid-cols-4 sm:gap-6">
          {t.stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-glass">
              <span className="block text-2xl font-extrabold text-slate-900 sm:text-3xl">{stat.value}</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t.aboutTitle}
            </span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t.aboutHeading}</h2>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">{t.aboutText}</p>
            <ul className="mt-6 space-y-3">
              {t.aboutPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm font-medium text-slate-700 sm:text-base">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href="#features"
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-7 text-sm font-bold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/25 active:scale-95"
            >
              {t.aboutCta}
              <NextIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
            <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-2xl shadow-slate-300/50">
              <video
                className="aspect-video w-full bg-slate-900 object-cover"
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster={VIDEO_POSTER}
              >
                <source src="/lana-intro.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t.featuresTitle}</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-500">{t.featuresSubtitle}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  style={{ animationDelay: `${index * 80}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-3 group rounded-2xl border border-slate-100 bg-white p-6 shadow-glass duration-500 fill-mode-both transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 to-primary/[0.04] px-6 py-14 text-center shadow-glass sm:px-12 sm:py-16">
          <div className="absolute -top-24 end-[-5%] h-72 w-72 rounded-full bg-primary/10 blur-[110px]" />
          <div className="absolute -bottom-24 start-[-5%] h-72 w-72 rounded-full bg-secondary/10 blur-[110px]" />
          <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{t.ctaBandTitle}</h2>
            <p className="text-sm text-slate-500 sm:text-base">{t.ctaBandSubtitle}</p>
            <Link
              href="/login"
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-8 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
            >
              {t.ctaBandButton}
              <NextIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-start">
          <BrandLogo size="xs" subtitle={t.footerTagline} />
          <p className="text-xs font-medium text-slate-400">
            &copy; {new Date().getFullYear()} Lana HRMS — {t.footerRights}
          </p>
        </div>
      </footer>
    </main>
  );
}

function HeaderLoginButton({ ctaPrimary }: { ctaPrimary: string }) {
  return (
    <Link
      href="/login"
      className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 active:scale-95 sm:h-10 sm:px-5 sm:text-sm"
    >
      {ctaPrimary}
    </Link>
  );
}
