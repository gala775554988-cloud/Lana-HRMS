"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Activity, BadgeCheck, BarChart3, Building2, CalendarDays, Clock3, FileText, Hospital, ShieldCheck, Users, WalletCards } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import type { Locale } from "@/lib/i18n";

type LoginExperienceProps = {
  locale: Locale;
  isAdminMode: boolean;
  children: ReactNode;
};

const modules = [
  { title: "Dashboard", subtitle: "Executive snapshot", icon: BarChart3, stat: "98%", rows: ["Live KPIs", "Pending approvals", "Today attendance"] },
  { title: "Employees", subtitle: "People directory", icon: Users, stat: "4.5K", rows: ["Profiles", "Contracts", "Documents"] },
  { title: "Attendance", subtitle: "Daily operations", icon: Clock3, stat: "09:00", rows: ["Check in", "Late alerts", "Shift logs"] },
  { title: "Leaves", subtitle: "Smart approvals", icon: CalendarDays, stat: "15", rows: ["Annual", "Sick leave", "Workflow"] },
  { title: "Payroll", subtitle: "Compensation", icon: WalletCards, stat: "SAR", rows: ["Net pay", "Allowances", "Deductions"] },
  { title: "Overtime", subtitle: "Extra hours", icon: Activity, stat: "124h", rows: ["Requests", "HR approval", "Excel export"] },
  { title: "Departments", subtitle: "Organization", icon: Building2, stat: "32", rows: ["Branches", "Managers", "Teams"] },
  { title: "Hospitals", subtitle: "Field coverage", icon: Hospital, stat: "18", rows: ["Sites", "Projects", "Employees"] },
  { title: "Reports", subtitle: "Enterprise BI", icon: FileText, stat: "BI", rows: ["Exports", "Dashboards", "Audit"] },
  { title: "Workflow", subtitle: "Governance", icon: ShieldCheck, stat: "RBAC", rows: ["Supervisor", "Branch", "HR"] }
];

const floatingCards = [
  { label: "عدد الموظفين", value: "4580", position: "left-[8%] top-[18%]", delay: 0 },
  { label: "طلبات بانتظار الاعتماد", value: "15", position: "right-[6%] top-[28%]", delay: 0.5 },
  { label: "الرواتب جاهزة", value: "98%", position: "left-[14%] bottom-[18%]", delay: 1 },
  { label: "Overtime", value: "124 Hours", position: "right-[10%] bottom-[13%]", delay: 1.5 }
];

function DemoPhone({ slideIndex, className = "", delay = 0 }: { slideIndex: number; className?: string; delay?: number }) {
  const item = modules[slideIndex % modules.length];
  const Icon = item.icon;

  return (
    <motion.div
      className={`relative h-[430px] w-[210px] rounded-[2.4rem] border border-white/20 bg-[#081B46] p-2 shadow-2xl shadow-[#081B46]/40 ${className}`}
      animate={{ y: [-8, 8, -8], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: 7, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="h-full overflow-hidden rounded-[2rem] bg-[#F7F9FC] p-3">
        <div className="mx-auto mb-3 h-4 w-20 rounded-b-2xl bg-[#081B46]" />
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-[#64748B]">{item.subtitle}</p>
              <h3 className="text-sm font-black text-[#262B63]">{item.title}</h3>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#3F46E8] text-white shadow-lg shadow-[#3F46E8]/20">
              <Icon className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-[#3F46E8] to-[#262B63] p-4 text-white shadow-xl shadow-[#3F46E8]/25">
            <p className="text-[11px] text-white/70">Lana Insight</p>
            <div className="mt-2 text-4xl font-black tracking-tight">{item.stat}</div>
            <div className="mt-4 grid gap-2">
              {item.rows.map((row) => (
                <div key={row} className="rounded-xl border border-white/10 bg-white/15 px-3 py-2 text-[11px] font-semibold text-white/90 backdrop-blur">
                  {row}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {["Active", "Pending", "Done", "Alerts"].map((label, index) => (
              <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
                <div className="mb-2 h-1.5 w-8 rounded-full bg-[#3F46E8]/25" />
                <p className="text-[9px] font-bold text-[#64748B]">{label}</p>
                <p className="mt-1 text-lg font-black text-[#262B63]">{(slideIndex + 2) * (index + 2)}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function MarketingPanel({ isRtl }: { isRtl: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => value + 1), 6000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-[linear-gradient(135deg,#081B46_0%,#182B72_45%,#1E4F78_70%,#274F86_100%)] p-8 text-white lg:block">
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.32)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.32)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-[#3F46E8]/30 blur-3xl" />
      <div className="absolute -bottom-24 left-10 h-80 w-80 rounded-full bg-[#274F86]/40 blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />

      {floatingCards.map((card) => (
        <motion.div
          key={card.label}
          className={`absolute z-20 rounded-3xl border border-white/15 bg-white/10 px-5 py-4 shadow-2xl shadow-[#081B46]/25 backdrop-blur-xl ${card.position}`}
          animate={{ y: [-8, 8, -8] }}
          transition={{ duration: 6, delay: card.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-xs font-semibold text-white/65">{card.label}</p>
          <p className="mt-1 text-2xl font-black text-white">{card.value}</p>
        </motion.div>
      ))}

      <motion.div
        className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-between"
        initial={{ opacity: 0, y: 20, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      >
        <div className={`flex items-center justify-between ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
          <BrandLogo
            href="/"
            size="md"
            textClassName="text-white"
            subtitle="Enterprise Human Resource Platform"
            subtitleClassName="text-white/60"
            logoClassName="border-white/25 shadow-xl shadow-[#081B46]/30"
          />
          <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white/90 backdrop-blur">
            Modern HR Platform
          </div>
        </div>

        <div className="grid flex-1 items-center gap-8 py-8 xl:grid-cols-[0.82fr_1fr]">
          <div className={`${isRtl ? "text-right" : "text-left"}`}>
            <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight xl:text-6xl">
              إدارة الموارد البشرية
              <span className="block text-white/90">بطريقة ذكية</span>
              <span className="block text-[#F7F9FC]/85">ومنصة واحدة.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/70 xl:text-lg">
              نظام متكامل لإدارة الموظفين، الحضور، الإجازات، الرواتب، الأوفر تايم، العهد، الموافقات، والتقارير داخل منصة واحدة.
            </p>
          </div>

          <div className="relative mx-auto h-[560px] w-[620px] max-w-full">
            <DemoPhone slideIndex={active} className="absolute left-1/2 top-16 z-30 -translate-x-1/2" delay={0} />
            <DemoPhone slideIndex={active + 1} className="absolute left-[14%] top-32 z-20 scale-[0.86] opacity-90" delay={0.8} />
            <DemoPhone slideIndex={active + 2} className="absolute right-[10%] top-28 z-10 scale-[0.9] opacity-95" delay={1.4} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Powered by Lana Medical</span>
          <span>Secure • Fast • Enterprise Ready</span>
        </div>
      </motion.div>
    </section>
  );
}

export function LoginExperience({ locale, isAdminMode, children }: LoginExperienceProps) {
  const isRtl = locale === "ar";

  const loginPanel = (
    <section className="relative flex min-h-screen items-center justify-center bg-[#F7F9FC] p-5 lg:min-h-0 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(63,70,232,0.10),transparent_25rem),radial-gradient(circle_at_80%_80%,rgba(38,43,99,0.08),transparent_24rem)]" />
      <ClientLanguageToggle variant="outline" className="absolute end-5 top-5 z-10 border-[#E5E7EB] bg-white/80 text-[#262B63] backdrop-blur hover:bg-white" />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-[24px] border border-white/70 bg-white/80 p-7 shadow-2xl shadow-[#262B63]/10 backdrop-blur-xl sm:p-8"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <div className="mb-7 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo href="/" size="lg" showText={false} logoClassName="border-[#E5E7EB] shadow-xl shadow-[#3F46E8]/10" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-[#111827]">Lana HRMS</h2>
          <p className="mt-2 text-sm font-semibold text-[#64748B]">
            {isAdminMode ? "دخول المسؤولين" : "نظام إدارة الموارد البشرية"}
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs leading-6 text-[#64748B]">
          يمكن تسجيل الدخول باستخدام <span className="font-bold text-[#262B63]">اسم المستخدم</span> أو <span className="font-bold text-[#262B63]">رقم الهوية الوطنية</span>.
        </p>
      </motion.div>
    </section>
  );

  return (
    <main className="min-h-screen bg-[#F7F9FC]">
      <div className={`grid min-h-screen ${isRtl ? "lg:grid-cols-[65fr_35fr]" : "lg:grid-cols-[35fr_65fr]"}`}>
        {isRtl ? (
          <>
            <MarketingPanel isRtl={isRtl} />
            {loginPanel}
          </>
        ) : (
          <>
            {loginPanel}
            <MarketingPanel isRtl={isRtl} />
          </>
        )}
      </div>
    </main>
  );
}
