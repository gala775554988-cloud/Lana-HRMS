"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Hospital,
  LineChart,
  LogIn,
  Send,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const modules = [
  { title: "Dashboard", icon: BarChart3, stat: "360°", tone: "from-[#2E2A8C] to-[#6D6AF8]", lines: ["Executive KPIs", "Live approvals", "Smart alerts"] },
  { title: "Employees", icon: Users, stat: "84+", tone: "from-[#4B46C6] to-[#6D6AF8]", lines: ["Profiles", "Documents", "Hierarchy"] },
  { title: "Attendance", icon: Clock3, stat: "98%", tone: "from-[#2E2A8C] to-[#22C55E]", lines: ["Check-in", "Late flags", "Daily logs"] },
  { title: "Payroll", icon: WalletCards, stat: "SAR", tone: "from-[#2E2A8C] to-[#4B46C6]", lines: ["Net pay", "Allowances", "Overtime"] },
  { title: "Leave", icon: CalendarDays, stat: "Flow", tone: "from-[#6D6AF8] to-[#F59E0B]", lines: ["Requests", "Balances", "Approvals"] },
  { title: "Departments", icon: Building2, stat: "Org", tone: "from-[#4B46C6] to-[#2E2A8C]", lines: ["Branches", "Roles", "Managers"] },
  { title: "Hospitals", icon: Hospital, stat: "Care", tone: "from-[#22C55E] to-[#6D6AF8]", lines: ["Sites", "Teams", "Coverage"] },
  { title: "Reports", icon: FileCheck2, stat: "BI", tone: "from-[#2E2A8C] to-[#EF4444]", lines: ["Exports", "Insights", "Audit"] },
  { title: "Overtime", icon: TimerReset, stat: "124h", tone: "from-[#6D6AF8] to-[#EF4444]", lines: ["Hours", "HR approval", "Excel"] },
  { title: "Workflow", icon: ShieldCheck, stat: "RBAC", tone: "from-[#111827] to-[#2E2A8C]", lines: ["Supervisor", "HR", "Final approval"] }
];

const stats: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "4580", label: "موظف", icon: Users },
  { value: "72", label: "مستشفى", icon: Hospital },
  { value: "34", label: "إدارة", icon: Building2 },
  { value: "120", label: "فرع", icon: LineChart },
  { value: "520", label: "عقد", icon: FileText },
  { value: "96%", label: "الحضور اليوم", icon: CheckCircle2 },
  { value: "124", label: "ساعات إضافية", icon: TimerReset },
  { value: "98%", label: "الرواتب جاهزة", icon: WalletCards }
];

const workflow: Array<{ label: string; icon: LucideIcon }> = [
  { label: "تسجيل الدخول", icon: LogIn },
  { label: "رفع الطلب", icon: Send },
  { label: "اعتماد المشرف", icon: Users },
  { label: "اعتماد المدير", icon: ShieldCheck },
  { label: "اعتماد الموارد البشرية", icon: Building2 },
  { label: "تنفيذ الطلب", icon: CheckCircle2 }
];

const features: Array<{ title: string; icon: LucideIcon; text: string }> = [
  { title: "Smart HR", icon: Sparkles, text: "تجربة ذكية لإدارة الموارد البشرية" },
  { title: "Payroll", icon: WalletCards, text: "رواتب وبدلات وخصومات" },
  { title: "Attendance", icon: Clock3, text: "حضور وانصراف وتحليل تأخير" },
  { title: "AI Assistant", icon: Sparkles, text: "Lana AI داخل كل الصفحات" },
  { title: "Analytics", icon: BarChart3, text: "مؤشرات وقرارات وتقارير" },
  { title: "Workflow", icon: ShieldCheck, text: "اعتمادات آمنة حسب الصلاحيات" }
];

const floatingBadges = ["✓ طلب جديد", "✓ تمت الموافقة", "✓ راتب جاهز", "✓ إشعار جديد", "✓ حضور اليوم", "✓ ساعات إضافية"];

function DemoPhone({ slideIndex, className = "", delay = 0 }: { slideIndex: number; className?: string; delay?: number }) {
  const item = modules[slideIndex % modules.length];
  const Icon = item.icon;
  const progress = ((slideIndex % modules.length) + 1) / modules.length * 100;

  return (
    <div
      className={`relative h-[455px] w-[218px] rounded-[2.55rem] border border-white/80 bg-[#081B46] p-2 shadow-2xl shadow-[#2E2A8C]/30 transition-transform duration-500 hover:rotate-0 sm:h-[545px] sm:w-[268px] ${className}`}
      style={{ animation: `lanaSlideUp 620ms ease both, phoneFloat 7s ${delay}s ease-in-out infinite` }}
    >
      <div className="absolute -right-3 top-20 h-24 w-1.5 rounded-full bg-[#081B46]" />
      <div className="absolute -left-3 top-28 h-16 w-1.5 rounded-full bg-[#081B46]" />
      <div className="relative h-full overflow-hidden rounded-[2.15rem] bg-[#F5F7FB] p-3 sm:rounded-[2.3rem] sm:p-4">
        <div className="mx-auto mb-3 h-5 w-24 rounded-b-2xl bg-[#081B46]" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#6B7280]">Lana HRMS</p>
            <h3 className="text-base font-black text-[#111827] sm:text-lg">{item.title}</h3>
          </div>
          <div className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-lg shadow-[#2E2A8C]/20`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className={`lana-slide-up rounded-3xl bg-gradient-to-br ${item.tone} p-4 text-white shadow-xl shadow-[#2E2A8C]/20 sm:p-5`} key={item.title}>
          <p className="text-xs text-white/75 sm:text-sm">Live module</p>
          <div className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{item.stat}</div>
          <div className="mt-4 grid gap-2">
            {item.lines.map((line) => <div key={line} className="rounded-2xl bg-white/15 px-3 py-2 text-xs backdrop-blur sm:text-sm">{line}</div>)}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
          {["Employees", "Requests", "Payroll", "Reports"].map((metric, metricIndex) => (
            <div key={metric} className="rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-sm sm:p-3">
              <div className="mb-2 h-1.5 w-10 rounded-full bg-[#6D6AF8]/30" />
              <p className="text-[10px] font-semibold text-[#6B7280] sm:text-[11px]">{metric}</p>
              <p className="mt-1 text-lg font-black text-[#2E2A8C] sm:text-xl">{(slideIndex + 1) * (metricIndex + 2)}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5">
          <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full bg-[#2E2A8C] transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GlassStat({ value, label, icon: Icon, index }: { value: string; label: string; icon: LucideIcon; index: number }) {
  return (
    <div
      className="group rounded-3xl border border-white/35 bg-white/70 p-4 text-right shadow-xl shadow-[#2E2A8C]/10 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-[#6D6AF8]/50 hover:bg-white/90 sm:p-5"
      style={{ animation: `lanaSlideUp 620ms ${index * 55}ms ease both` }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#2E2A8C]/10 text-[#2E2A8C] transition group-hover:bg-[#2E2A8C] group-hover:text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="h-2 w-10 rounded-full bg-[#6D6AF8]/20" />
      </div>
      <p className="text-3xl font-black tracking-tight text-[#111827]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#6B7280]">{label}</p>
    </div>
  );
}

function MiniDashboard() {
  const bars = [65, 82, 45, 92, 58, 74];
  const line = [54, 80, 68, 96, 88, 110, 102];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-2xl shadow-[#2E2A8C]/12 backdrop-blur-xl lana-slide-up">
      <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#6D6AF8]/20 blur-3xl" />
      <div className="relative mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B7280]">Analytics cockpit</p>
          <h3 className="mt-1 text-2xl font-black text-[#111827]">Dashboard مصغر</h3>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2E2A8C] text-white shadow-lg shadow-[#2E2A8C]/20">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>

      <div className="relative grid gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Employee Growth", "+18%"],
            ["Attendance", "96%"],
            ["Open Positions", "24"]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white/90 p-3 shadow-sm">
              <p className="text-[10px] font-bold text-[#6B7280]">{label}</p>
              <p className="mt-2 text-xl font-black text-[#2E2A8C]">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white/90 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-black text-[#111827]">Employee Growth</p>
            <TrendingUp className="h-4 w-4 text-[#22C55E]" />
          </div>
          <svg viewBox="0 0 420 150" className="h-40 w-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="heroLine" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#6D6AF8" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#6D6AF8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M 0 130 ${line.map((item, index) => `L ${index * 70} ${150 - item}`).join(" ")} L 420 150 L 0 150 Z`} fill="url(#heroLine)" />
            <path d={`M 0 130 ${line.map((item, index) => `L ${index * 70} ${150 - item}`).join(" ")}`} fill="none" stroke="#2E2A8C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white/90 p-4 shadow-sm">
            <p className="mb-4 text-sm font-black text-[#111827]">Leave Requests</p>
            <div className="flex h-32 items-end gap-2">
              {bars.map((bar, index) => <span key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-[#2E2A8C] to-[#6D6AF8] transition-all duration-700" style={{ height: `${bar}%` }} />)}
            </div>
          </div>
          <div className="rounded-3xl border border-[#E5E7EB] bg-white/90 p-4 shadow-sm">
            <p className="mb-4 text-sm font-black text-[#111827]">Payroll</p>
            <div className="grid h-32 place-items-center">
              <div className="grid h-28 w-28 place-items-center rounded-full border-[16px] border-[#2E2A8C] border-l-[#6D6AF8] border-t-[#22C55E] text-center">
                <span className="text-xl font-black text-[#2E2A8C]">98%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowTimeline() {
  return (
    <div className="rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-xl shadow-[#2E2A8C]/10 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-black text-[#111827]">Workflow النظام</h3>
        <span className="rounded-full bg-[#2E2A8C]/10 px-3 py-1 text-xs font-bold text-[#2E2A8C]">Live automation</span>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {workflow.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative min-w-[160px] snap-center">
              {index < workflow.length - 1 ? <div className="absolute top-7 -left-5 hidden h-0.5 w-8 bg-[#6D6AF8]/30 md:block" /> : null}
              <div className="rounded-3xl border border-[#E5E7EB] bg-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#2E2A8C]/10">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#2E2A8C] text-white shadow-lg shadow-[#2E2A8C]/20">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-black text-[#111827]">{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-lg shadow-[#2E2A8C]/8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-[#2E2A8C]/12" style={{ animation: `lanaSlideUp 520ms ${index * 55}ms ease both` }}>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#2E2A8C]/10 text-[#2E2A8C]">
              <Icon className="h-5 w-5" />
            </div>
            <p className="font-black text-[#111827]">{feature.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#6B7280]">{feature.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function PhoneShowcase() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => value + 1), 6000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-[600px] lg:min-h-[680px]">
      <div className="absolute inset-x-4 top-16 h-[34rem] rounded-[4rem] bg-gradient-to-br from-[#2E2A8C]/20 via-[#6D6AF8]/10 to-white/20 blur-3xl" />
      <HeroDemoPhone slideIndex={index} className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rotate-[-4deg]" delay={0} />
      <HeroDemoPhone slideIndex={index + 1} className="absolute left-[3%] top-24 z-20 hidden scale-[0.78] rotate-[7deg] opacity-90 md:block" delay={0.9} />
      <HeroDemoPhone slideIndex={index + 2} className="absolute right-[2%] top-32 z-20 hidden scale-[0.82] rotate-[-10deg] opacity-90 md:block" delay={1.6} />

      {floatingBadges.map((badge, badgeIndex) => (
        <div
          key={badge}
          className={`absolute z-40 hidden rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-black text-[#2E2A8C] shadow-xl shadow-[#2E2A8C]/10 backdrop-blur-xl transition hover:scale-105 sm:block ${badgeIndex % 2 === 0 ? "right-2" : "left-2"}`}
          style={{ top: `${16 + badgeIndex * 12}%`, animation: `lanaSlideUp 600ms ${badgeIndex * 70}ms ease both, phoneFloat ${6 + badgeIndex}s ${badgeIndex * 0.35}s ease-in-out infinite` }}
        >
          {badge}
        </div>
      ))}
    </div>
  );
}

export function HeroDemoPhone({ slideIndex = 0, className = "", delay = 0 }: { slideIndex?: number; className?: string; delay?: number }) {
  const item = modules[slideIndex % modules.length];
  const Icon = item.icon;
  const progress = useMemo(() => ((slideIndex % modules.length) + 1) / modules.length * 100, [slideIndex]);

  return (
    <div className={`relative mx-auto h-[500px] w-[250px] rounded-[3rem] border border-white/80 bg-slate-950 p-3 shadow-2xl shadow-[#2E2A8C]/30 transition-transform duration-500 hover:rotate-0 sm:h-[600px] sm:w-[300px] ${className}`} style={{ animation: `phoneFloat 7s ${delay}s ease-in-out infinite` }} aria-label="Lana HRMS interactive product demo">
      <div className="absolute -right-4 top-20 h-24 w-2 rounded-full bg-slate-900" />
      <div className="absolute -left-4 top-28 h-16 w-2 rounded-full bg-slate-900" />
      <div className="relative h-full overflow-hidden rounded-[2.35rem] bg-[#F5F7FB] p-4">
        <div className="mx-auto mb-4 h-6 w-28 rounded-b-2xl bg-slate-950" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280]">Lana HRMS</p>
            <h3 className="text-lg font-black text-[#111827]">{item.title}</h3>
          </div>
          <div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-lg shadow-[#2E2A8C]/20`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className={`lana-slide-up rounded-3xl bg-gradient-to-br ${item.tone} p-5 text-white shadow-xl shadow-[#2E2A8C]/20`} key={item.title}>
          <p className="text-sm text-white/75">Live module</p>
          <div className="mt-4 text-5xl font-black tracking-tight">{item.stat}</div>
          <div className="mt-5 grid gap-2">
            {item.lines.map((line) => <div key={line} className="rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">{line}</div>)}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {["Employees", "Requests", "Payroll", "Reports"].map((metric, metricIndex) => (
            <div key={metric} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
              <div className="mb-2 h-2 w-12 rounded-full bg-[#6D6AF8]/30" />
              <p className="text-[11px] font-semibold text-[#6B7280]">{metric}</p>
              <p className="mt-1 text-xl font-black text-[#2E2A8C]">{(slideIndex + 1) * (metricIndex + 2)}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-5 bottom-5">
          <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full bg-[#2E2A8C] transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex justify-center gap-1.5">
            {modules.map((slide, dotIndex) => <span key={slide.title} className={`h-1.5 rounded-full transition-all ${dotIndex === slideIndex % modules.length ? "w-6 bg-[#2E2A8C]" : "w-1.5 bg-[#D1D5DB]"}`} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroMiddleExperience() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 pb-12 pt-4 lg:px-8">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/35 p-5 shadow-2xl shadow-[#2E2A8C]/10 backdrop-blur-2xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(109,106,248,0.22),transparent_28rem),radial-gradient(circle_at_90%_10%,rgba(46,42,140,0.18),transparent_24rem),linear-gradient(135deg,rgba(8,27,70,0.04),rgba(255,255,255,0.55))]" />
        <div className="relative space-y-10">
          <div className="mx-auto max-w-4xl text-center lana-slide-up">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-black text-[#2E2A8C] shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" /> Lana AI powered workspace
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-[#111827] md:text-6xl">إدارة الموارد البشرية الذكية</h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#6B7280] md:text-xl">
              منصة موحدة لإدارة الموظفين والرواتب والإجازات والعقود والحضور والأداء والموافقات باستخدام أحدث التقنيات والذكاء الاصطناعي.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => <GlassStat key={stat.label} {...stat} index={index} />)}
          </div>

          <WorkflowTimeline />

          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="order-2 lg:order-1"><MiniDashboard /></div>
            <div className="order-1 lg:order-2"><PhoneShowcase /></div>
          </div>

          <FeatureStrip />
        </div>
      </div>
    </section>
  );
}

export { MiniDashboard, WorkflowTimeline, FeatureStrip };
