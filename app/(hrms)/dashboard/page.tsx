import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getRequestDictionary } from "@/lib/i18n-server";
import { CompanyOverview, OverviewSkeleton } from "@/app/(hrms)/analytics/page";
import {
  Users, Building2, GitPullRequest, WalletCards, ShieldCheck, Sparkles,
  ArrowUpRight, Clock3, Activity, CheckCircle2, Hospital, CalendarClock, AlertTriangle, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Brand gradient (rose -> gold -> slate-blue), matches app/globals.css's
// --primary/--secondary token hues; kept as a literal gradient string since
// Tailwind has no single utility for a precise 3-stop percentage gradient.
const BRAND_GRADIENT = "linear-gradient(90deg, #F4708F 0%, #F2B366 55%, #9CA8B0 100%)";

export const metadata = {
  title: "لوحة التحكم المركزية — Pro Max Executive Hub | Lana HRMS",
  description: "المستشعر الذكي وإدارة الموارد البشرية التنفيذية لمنصات لانا الطبية والتشغيلية."
};

function DiagnosticConfessionBox({ err, location }: { err: any; location: string }) {
  const errMsg = err?.message || String(err || "Unknown error");
  const stack = err?.stack || "";
  return (
    <div className="rounded-3xl border border-rose-300 bg-rose-50/95 p-6 shadow-xl dark:border-rose-800 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-600 text-white shadow-md shrink-0">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-black">اعتراف النظام بالخطأ التقني المباشر (`{location}`)</h2>
          <p className="text-xs text-rose-700 dark:text-rose-300 font-bold">تم التقاط الاستثناء برمجياً قبل إخفائه من خادم الإنتاج لبيان السبب بدقة</p>
        </div>
      </div>
      <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 p-4 border border-rose-200 dark:border-rose-900/60 font-mono text-xs text-rose-800 dark:text-rose-200 overflow-x-auto space-y-2">
        <p className="font-bold text-sm text-rose-600 dark:text-rose-400">الرسالة التقنية (Error Message):</p>
        <p className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-lg">{errMsg}</p>
        {stack ? (
          <>
            <p className="font-bold text-sm text-rose-600 dark:text-rose-400 pt-2">مسار التنفيذ والسطر (Stack Trace):</p>
            <pre className="p-2 bg-slate-100 dark:bg-slate-950 rounded-lg text-[11px] leading-relaxed max-h-64 overflow-y-auto">{stack}</pre>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default async function CentralDashboardPage() {
  try {
    const session = await auth().catch((e: any) => { console.error("Dashboard auth error:", e); return null; });
    const { locale, dictionary } = await getRequestDictionary().catch(() => ({ locale: "ar" as const, dictionary: {} as any }));

    const quickShortcuts = [
      {
        title: "مسير الرواتب والمالية",
        description: "إصدار الرواتب الشهرية، السلف، الاستقطاعات، والبدلات.",
        href: "/payroll",
        icon: WalletCards,
        badge: "المالية والرواتب",
        color: "#F4708F",
        bgLight: "bg-rose-50/70 border-rose-200/80 hover:border-rose-400 dark:bg-rose-950/30 dark:border-rose-800/60"
      },
      {
        title: "المستشفيات ومواقع التشغيل",
        description: "توزيع الكوادر الطبية والفروع وإحصاءات الحضور الميداني.",
        href: "/hospitals",
        icon: Hospital,
        badge: "القطاع الطبي",
        color: "#F2B366",
        bgLight: "bg-amber-50/70 border-amber-200/80 hover:border-amber-400 dark:bg-amber-950/30 dark:border-amber-800/60"
      },
      {
        title: "مركز الموافقات والطلبات",
        description: "إدارة الإجازات، العمل الإضافي، وسلسلة الاعتمادات التنفيذية.",
        href: "/approvals",
        icon: GitPullRequest,
        badge: "مباشر",
        color: "#E2955A",
        bgLight: "bg-orange-50/70 border-orange-200/80 hover:border-orange-400 dark:bg-orange-950/30 dark:border-orange-800/60"
      },
      {
        title: "إدارة الموظفين والعقود",
        description: "سجل الموظفين، العقود، التأمين، وتحديث الملفات الشخصية.",
        href: "/employees",
        icon: Users,
        badge: "دليل الموظفين",
        color: "#9CA8B0",
        bgLight: "bg-slate-50/70 border-slate-200/80 hover:border-slate-400 dark:bg-slate-950/30 dark:border-slate-800/60"
      }
    ];

    return (
      <div className="space-y-8 pb-10">
        {/* Pro Max Executive Header Card */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl" style={{ background: BRAND_GRADIENT }}>
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "#E2955A" }}>
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
                  <span>المزامنة والتشغيل الفوري متصل بأعلى كفاءة</span>
                </span>
                <Badge className="bg-white px-3 py-1 text-xs font-black shadow-sm hover:bg-white" style={{ color: "#D9557A" }}>
                  👑 لوحة التحكم المركزية Pro Max
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                أهلاً بك، <span>{session?.user?.name || "الإدارة التنفيذية"}</span>
              </h1>
              <p className="text-sm font-semibold text-white/90 max-w-2xl leading-relaxed">
                مركز التحكم التنفيذي Pro Max لمنصة لانا الطبية؛ رصد لحظي لحركة الكوادر، الاعتمادات، الرواتب، وتكامل بيانات Odoo لحظياً.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/employees?action=create"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black shadow-lg transition-all hover:scale-105 hover:bg-slate-50 hover:shadow-xl active:scale-95"
                style={{ color: "#D9557A" }}
              >
                <Users className="h-4.5 w-4.5" />
                <span>إضافة موظف جديد</span>
              </Link>
              <Link
                href="/attendance"
                className="inline-flex items-center gap-2 rounded-2xl border border-white px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-white/20"
              >
                <CalendarClock className="h-4.5 w-4.5" />
                <span>مراقبة الحضور</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Navigation Shortcuts Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5" style={{ color: "#F4708F" }} />
              <span>الوصول السريع للأنظمة المركزية</span>
            </h2>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">اختر الوحدة المطلوبة للانتقال المباشر</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickShortcuts.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${item.bgLight}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                      style={{ backgroundColor: item.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-extrabold border-slate-300/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80">
                      {item.badge}
                    </Badge>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 transition-colors flex items-center justify-between">
                    <span className="group-hover:opacity-80">{item.title}</span>
                    <ArrowUpRight className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: item.color }} />
                  </h3>
                  <p className="mt-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Company Overview (KPIs, Live Metrics, Lana AI Executive Insights) */}
        <Suspense fallback={<OverviewSkeleton />}>
          <CompanyOverview locale={locale || "ar"} dictionary={dictionary || {}} showCharts={false} />
        </Suspense>
      </div>
    );
  } catch (err: any) {
    return <DiagnosticConfessionBox err={err} location="CentralDashboardPage (/dashboard)" />;
  }
}
