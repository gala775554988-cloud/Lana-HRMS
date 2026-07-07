"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, Clock3, FileCheck2, Hospital, ShieldCheck, Users, WalletCards } from "lucide-react";

const slides = [
  { title: "Dashboard", icon: BarChart3, stat: "360°", tone: "from-[#2E2A8C] to-[#6D6AF8]", lines: ["Executive KPIs", "Live approvals", "Smart alerts"] },
  { title: "Employees", icon: Users, stat: "84+", tone: "from-[#4B46C6] to-[#6D6AF8]", lines: ["Profiles", "Documents", "Hierarchy"] },
  { title: "Attendance", icon: Clock3, stat: "98%", tone: "from-[#2E2A8C] to-[#22C55E]", lines: ["Check-in", "Late flags", "Daily logs"] },
  { title: "Payroll", icon: WalletCards, stat: "SAR", tone: "from-[#2E2A8C] to-[#4B46C6]", lines: ["Net pay", "Allowances", "Overtime"] },
  { title: "Leave", icon: CalendarDays, stat: "Flow", tone: "from-[#6D6AF8] to-[#F59E0B]", lines: ["Requests", "Balances", "Approvals"] },
  { title: "Departments", icon: Building2, stat: "Org", tone: "from-[#4B46C6] to-[#2E2A8C]", lines: ["Branches", "Roles", "Managers"] },
  { title: "Hospitals", icon: Hospital, stat: "Care", tone: "from-[#22C55E] to-[#6D6AF8]", lines: ["Sites", "Teams", "Coverage"] },
  { title: "Reports", icon: FileCheck2, stat: "BI", tone: "from-[#2E2A8C] to-[#EF4444]", lines: ["Exports", "Insights", "Audit"] },
  { title: "Workflow", icon: ShieldCheck, stat: "RBAC", tone: "from-[#111827] to-[#2E2A8C]", lines: ["Supervisor", "HR", "Final approval"] }
];

export function HeroDemoPhone() {
  const [index, setIndex] = useState(0);
  const slide = slides[index % slides.length];
  const Icon = slide.icon;
  const progress = useMemo(() => ((index % slides.length) + 1) / slides.length * 100, [index]);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => value + 1), 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto h-[560px] w-[280px] rotate-[-5deg] rounded-[3rem] border border-white/80 bg-slate-950 p-3 shadow-2xl shadow-[#2E2A8C]/30 transition-transform duration-500 hover:rotate-0 sm:h-[620px] sm:w-[310px]" aria-label="Lana HRMS interactive product demo">
      <div className="absolute -right-4 top-20 h-24 w-2 rounded-full bg-slate-900" />
      <div className="absolute -left-4 top-28 h-16 w-2 rounded-full bg-slate-900" />
      <div className="relative h-full overflow-hidden rounded-[2.35rem] bg-[#F5F7FB] p-4">
        <div className="mx-auto mb-4 h-6 w-28 rounded-b-2xl bg-slate-950" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280]">Lana HRMS</p>
            <h3 className="text-lg font-black text-[#111827]">{slide.title}</h3>
          </div>
          <div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${slide.tone} text-white shadow-lg shadow-[#2E2A8C]/20`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className={`lana-slide-up rounded-3xl bg-gradient-to-br ${slide.tone} p-5 text-white shadow-xl shadow-[#2E2A8C]/20`} key={slide.title}>
          <p className="text-sm text-white/75">Live module</p>
          <div className="mt-4 text-5xl font-black tracking-tight">{slide.stat}</div>
          <div className="mt-5 grid gap-2">
            {slide.lines.map((line) => <div key={line} className="rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">{line}</div>)}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {["Employees", "Requests", "Payroll", "Reports"].map((item, itemIndex) => (
            <div key={item} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
              <div className="mb-2 h-2 w-12 rounded-full bg-[#6D6AF8]/30" />
              <p className="text-[11px] font-semibold text-[#6B7280]">{item}</p>
              <p className="mt-1 text-xl font-black text-[#2E2A8C]">{(index + 1) * (itemIndex + 2)}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-5 bottom-5">
          <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full bg-[#2E2A8C] transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex justify-center gap-1.5">
            {slides.map((item, dotIndex) => <span key={item.title} className={`h-1.5 rounded-full transition-all ${dotIndex === index % slides.length ? "w-6 bg-[#2E2A8C]" : "w-1.5 bg-[#D1D5DB]"}`} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
