"use client";

import React, { useState } from "react";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { LoginCard } from "@/components/auth/login-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Monitor, Video, LayoutGrid, Users, ShieldCheck, Activity, CalendarCheck2, FileText, Hospital, WalletCards } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

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

const stats = [
  { label: "عدد الموظفين", value: "4580", icon: Users },
  { label: "عدد المستشفيات", value: "72", icon: Hospital },
  { label: "الطلبات الجديدة", value: "15", icon: FileText },
  { label: "الرواتب", value: "98%", icon: WalletCards },
  { label: "الأوفر تايم", value: "124h", icon: Activity },
  { label: "الإجازات", value: "32", icon: CalendarCheck2 }
];

export function LoginHeroContainer({ dictionary, isAr }: { dictionary: Dictionary; isAr: boolean }) {
  const [activeSection, setActiveSection] = useState<"hero" | "login">("login"); // Defaulting or switching smoothly
  const [heroOpacity, setHeroOpacity] = useState(1);
  const [loginOpacity, setLoginOpacity] = useState(1);

  const switchToLogin = () => {
    setHeroOpacity(0);
    setTimeout(() => {
      setActiveSection("login");
      setLoginOpacity(1);
    }, 500);
  };

  const switchToHero = () => {
    setLoginOpacity(0);
    setTimeout(() => {
      setActiveSection("hero");
      setHeroOpacity(1);
    }, 500);
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden" dir={isAr ? "rtl" : "ltr"}>
      {/* 1. الحاوية الأولى (Hero Section) */}
      <div
        id="heroSection"
        style={{
          transition: "opacity 0.5s ease-in-out",
          opacity: activeSection === "hero" ? heroOpacity : 0,
          pointerEvents: activeSection === "hero" ? "auto" : "none",
          display: activeSection === "hero" ? "block" : "none"
        }}
        className="w-full min-h-screen bg-[#030C1B] text-white p-6 sm:p-12"
      >
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex items-center justify-between">
            <BrandLogo href="/" size="md" subtitle="Enterprise Human Resource Platform" textClassName="text-white" subtitleClassName="text-white/65" />
            <div className="flex items-center gap-4">
              <ClientLanguageToggle variant="outline" />
              <Button
                id="loginBtn"
                onClick={switchToLogin}
                className="rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-black px-6 py-3.5 shadow-lg shadow-teal-500/25 flex items-center gap-2"
              >
                <span>تسجيل الدخول للنظام</span>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="rounded-full border border-teal-500/40 bg-teal-950/50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-300">
                Pro Max SaaS HR Platform
              </span>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.25]">
                إدارة الموارد البشرية
                <span className="block bg-gradient-to-l from-teal-400 to-emerald-300 bg-clip-text text-transparent">بطريقة ذكية ومنصة واحدة.</span>
              </h1>
              <p className="text-base text-slate-400 leading-relaxed max-w-lg">
                نظام متكامل لإدارة الموظفين، الحضور، الإجازات، الرواتب، الأوفر تايم، العهد، والاعتمادات التنفيذية مع تكامل Odoo المباشر.
              </p>
              <Button
                onClick={switchToLogin}
                size="lg"
                className="rounded-2xl bg-white text-slate-900 font-black hover:bg-slate-100 shadow-xl px-8 h-14"
              >
                البدء الآن وتسجيل الدخول
              </Button>
            </div>

            <div className="relative min-h-[520px] flex justify-center">
              <div className="absolute inset-x-0 top-12 h-[28rem] rounded-[4rem] bg-teal-500/10 blur-3xl pointer-events-none" />
              <div className="relative z-20 w-[280px] rounded-[3rem] border border-white/10 bg-[#030C1B] p-3 shadow-2xl shadow-black/40">
                <div className="h-full rounded-[2.35rem] bg-[#F7F9FC] p-3.5 text-[#111827] space-y-3 text-start">
                  <div className="mx-auto mb-2 h-5 w-28 rounded-b-2xl bg-[#030C1B]" />
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-[11px] font-black text-[#0B192B]">Lana HR Platform</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Enterprise</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl bg-teal-600 p-2 text-white"><p className="text-[9px]">Platform</p><p className="text-sm font-black">360°</p></div>
                    <div className="rounded-xl border bg-white p-2"><p className="text-[9px] text-slate-500">الإجازات</p><p className="text-sm font-black text-teal-600">24</p></div>
                    <div className="rounded-xl border bg-white p-2"><p className="text-[9px] text-slate-500">الحضور</p><p className="text-sm font-black text-emerald-600">16</p></div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-slate-900 shadow-md">
                    <video className="h-28 w-full object-cover" controls playsInline preload="none" poster={PHONE_VIDEO_POSTER}>
                      <source src="/lana-intro.mp4" type="video/mp4" />
                    </video>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 pt-8 border-t border-white/10">
            {stats.map((st) => (
              <div key={st.label}>
                <span className="block text-2xl font-black text-teal-400">{st.value}</span>
                <span className="block text-xs text-slate-400 mt-1">{st.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. الحاوية الثانية (Login Section) */}
      <div
        id="loginSection"
        style={{
          transition: "opacity 0.5s ease-in-out",
          opacity: activeSection === "login" ? loginOpacity : 0,
          pointerEvents: activeSection === "login" ? "auto" : "none",
          display: activeSection === "login" ? "block" : "none"
        }}
        className="w-full min-h-screen bg-white dark:bg-slate-950 p-6 flex flex-col justify-between"
      >
        <div className="flex justify-between items-center max-w-6xl mx-auto w-full pt-4">
          <BrandLogo href="/" size="sm" showText={true} />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={switchToHero} className="text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400">
              استعراض مميزات المنصة (Hero View)
            </Button>
            <ClientLanguageToggle variant="outline" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center py-12">
          <LoginCard dictionary={dictionary} />
        </div>

        <div className="text-center py-4 text-xs font-semibold text-slate-400 dark:text-slate-600 border-t border-slate-100 dark:border-slate-900">
          © {new Date().getFullYear()} شركة لانا الطبية — نظام الموارد البشرية الفائق (Lana HRMS Pro Max)
        </div>
      </div>
    </div>
  );
}
