"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, TrendingUp, AlertCircle, ExternalLink, RefreshCw, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AnalyticsMetrics = {
  totalEmployees: number;
  activeHospitals: number;
  pendingApprovals: number;
  todayAttendance: number;
};

export function LanaAnalytics() {
  const router = useRouter();
  const [insight, setInsight] = useState("جاري تحليل بيانات القوى العاملة والموافقات الحية في خادم Neon...");
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInsight = () => {
    setIsLoading(true);
    fetch("/api/lana/analytics")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.summary) {
          setInsight(data.summary);
          setMetrics(data.metrics || null);
        } else {
          setInsight("تعذر سحب التحليل اللحظي؛ يتم الآن المزامنة مع بيانات قاعدة البيانات الرئيسية.");
        }
      })
      .catch(() => {
        setInsight("تعذر الاتصال بخادم التحليل الذكي؛ تحقق من الاتصال بالشبكة أو أعد المحاولة.");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchInsight();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-purple-900 to-teal-900 p-6 text-white shadow-2xl transition-all duration-300 hover:shadow-primary/50" dir="rtl">
      {/* Background Decorative Grid and Glow */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 backdrop-blur-md text-yellow-400 border border-white/15 shadow-inner">
              <Sparkles className={`h-6 w-6 ${isLoading ? "animate-spin" : "animate-pulse"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">خلاصة لانا الذكية اللحظية</h3>
                <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 px-2 py-0.5 text-[10px] font-mono">
                  Live AI Engine
                </Badge>
              </div>
              <p className="text-xs text-white/70 font-light mt-0.5">
                التحليل التنفيذي المدمج لبيانات المستشفيات والموارد البشرية في الوقت الفعلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={fetchInsight}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition border border-white/10 disabled:opacity-50"
              title="تحديث التحليل الآن"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* Insight Text */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4.5 backdrop-blur-sm">
          <p className="text-sm sm:text-base font-medium text-white/95 leading-relaxed italic">
            &ldquo;{insight}&rdquo;
          </p>
        </div>

        {/* Live Metrics Pills */}
        {metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="rounded-xl bg-black/20 border border-white/10 p-2.5 flex items-center justify-between">
              <span className="text-xs text-white/70">القوى العاملة</span>
              <span className="font-mono font-black text-sm text-teal-300">{metrics.totalEmployees} موظف</span>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2.5 flex items-center justify-between">
              <span className="text-xs text-white/70">المستشفيات النشطة</span>
              <span className="font-mono font-black text-sm text-primary/30">{metrics.activeHospitals} موقع</span>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2.5 flex items-center justify-between">
              <span className="text-xs text-white/70">حضور اليوم</span>
              <span className="font-mono font-black text-sm text-emerald-300">{metrics.todayAttendance} حركة</span>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2.5 flex items-center justify-between">
              <span className="text-xs text-white/70">موافقات معلقة</span>
              <span className="font-mono font-black text-sm text-amber-300">{metrics.pendingApprovals} طلب</span>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
            <span>متصل ببيانات Neon PostgreSQL الحية ومؤمن بصلاحيات RBAC</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/approvals")}
              className="h-9 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs font-bold gap-1.5 backdrop-blur-sm"
            >
              <span>إدارة الموافقات المعلقة</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/reports")}
              className="h-9 rounded-xl bg-white text-slate-900 hover:bg-white/90 text-xs font-black shadow-lg gap-1.5"
            >
              <span>عرض التقرير الكامل</span>
              <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
