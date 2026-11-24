"use client";

import { BriefcaseBusiness, CalendarCheck2, ChartNoAxesCombined, ShieldCheck, Users, WalletCards } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { LoginCard } from "@/components/auth/login-card";
import type { Dictionary } from "@/lib/i18n";

const modules = [
  { label: "إدارة الموظفين", icon: Users },
  { label: "الحضور والإجازات", icon: CalendarCheck2 },
  { label: "الرواتب والمزايا", icon: WalletCards },
  { label: "التقارير والتحليلات", icon: ChartNoAxesCombined }
];

export function LoginHeroContainer({ dictionary, isAr }: { dictionary: Dictionary; isAr: boolean }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,.92fr)]" dir={isAr ? "rtl" : "ltr"}>
      <section className="relative hidden overflow-hidden bg-[hsl(var(--sidebar-bg))] p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_15%_20%,rgba(198,227,154,.24),transparent_34%),radial-gradient(circle_at_85%_78%,rgba(255,255,255,.1),transparent_28%)]" />
        <div className="relative flex items-center justify-between">
          <BrandLogo href="/login" size="md" title="مدار HR" subtitle="MADAR HR" textClassName="text-white" subtitleClassName="text-[#c6e39a]/60" logoClassName="border-white bg-white text-primary" />
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#c6e39a]/75">منصة مؤسسية آمنة</span>
        </div>

        <div className="relative my-auto max-w-2xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-[#c6e39a]">
            <ShieldCheck className="h-4 w-4" />
            إدارة موحّدة وقرارات أوضح
          </span>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.35] xl:text-5xl">كل أعمال الموارد البشرية في مكان واحد</h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-[#c6e39a]/70">
            نظّم بيانات الموظفين والحضور والإجازات والرواتب والطلبات من خلال تجربة سهلة وواضحة تساعد فريقك على إنجاز العمل بسرعة.
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-2 gap-3">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <div key={module.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-[#c6e39a]"><Icon className="h-4.5 w-4.5" /></span>
                  <span className="text-sm font-medium text-white/90">{module.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-[#c6e39a]/55">
          <BriefcaseBusiness className="h-4 w-4" />
          <span>نظام مدار HR لإدارة دورة حياة الموظف بكفاءة</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center bg-card px-5 py-10 sm:px-10">
        <div className="absolute start-5 top-5 flex items-center gap-3 lg:start-auto lg:end-7 lg:top-7">
          <ClientLanguageToggle variant="ghost" />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandLogo href="/login" size="md" title="مدار HR" subtitle="MADAR HR" />
          </div>
          <LoginCard dictionary={dictionary} />
          <p className="mt-6 text-center text-xs text-muted-foreground">الدخول مخصص للمستخدمين المصرح لهم فقط</p>
        </div>
      </section>
    </main>
  );
}
