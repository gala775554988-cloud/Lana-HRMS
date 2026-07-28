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
        title: "إدارة الموظفين والعقود",
        description: "سجل الموظفين، العقود، التأمين، وتحديث الملفات الشخصية.",
        href: "/employees",
        icon: Users,
        badge: "دليل الموظفين",
        gradient: "from-violet-700 via-violet-600 to-violet-800",
        bgLight: "bg-violet-50/70 border-violet-200/80 hover:border-violet-400 dark:bg-violet-950/30 dark:border-violet-800/60"
      },
      {
        title: "مركز الموافقات والطلبات",
        description: "إدارة الإجازات، العمل الإضافي، وسلسلة الاعتمادات التنفيذية.",
        href: "/approvals",
        icon: GitPullRequest,
        badge: "مباشر",
        gradient: "from-fuchsia-600 via-fuchsia-500 to-pink-600",
        bgLight: "bg-fuchsia-50/70 border-fuchsia-200/80 hover:border-fuchsia-400 dark:bg-fuchsia-950/30 dark:border-fuchsia-800/60"
      },
      {
        title: "المستشفيات ومواقع التشغيل",
        description: "توزيع الكوادر الطبية والفروع وإحصاءات الحضور الميداني.",
        href: "/hospitals",
        icon: Hospital,
        badge: "القطاع الطبي",
        gradient: "from-violet-600 via-purple-600 to-fuchsia-600",
        bgLight: "bg-purple-50/70 border-purple-200/80 hover:border-purple-400 dark:bg-purple-950/30 dark:border-purple-800/60"
      },
      {
        title: "مسير الرواتب والمالية",
        description: "إصدار الرواتب الشهرية، السلف، الاستقطاعات، والبدلات.",
        href: "/payroll",
        icon: WalletCards,
        badge: "المالية والرواتب",
        gradient: "from-violet-500 via-violet-600 to-purple-700",
        bgLight: "bg-violet-50/70 border-violet-200/80 hover:border-violet-400 dark:bg-violet-950/30 dark:border-violet-800/60"
      }
    ];

    return (
      <div className="space-y-8 pb-10">
        {/* Pro Max Executive Header Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-6 sm:p-8 shadow-xl shadow-violet-900/20">
          <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 end-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
                  <span>المزامنة والتشغيل الفوري متصل بأعلى كفاءة</span>
                </span>
                <Badge className="bg-white px-3 py-1 text-xs font-black text-violet-700 shadow-sm hover:bg-white">
                  👑 لوحة التحكم المركزية Pro Max
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                أهلاً بك، <span>{session?.user?.name || "الإدارة التنفيذية"}</span>
              </h1>
              <p className="text-sm font-semibold text-violet-100 max-w-2xl leading-relaxed">
                مركز التحكم التنفيذي Pro Max لمنصة لانا الطبية؛ رصد لحظي لحركة الكوادر، الاعتمادات، الرواتب، وتكامل بيانات Odoo لحظياً.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/employees?action=create"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-violet-700 shadow-lg transition-all hover:scale-105 hover:bg-violet-50 hover:shadow-xl active:scale-95"
              >
                <Users className="h-4.5 w-4.5" />
                <span>إضافة موظف جديد</span>
              </Link>
              <Link
                href="/attendance"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/5 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-white/10"
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
              <Activity className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
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
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${item.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-extrabold border-slate-300/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80">
                      {item.badge}
                    </Badge>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors flex items-center justify-between">
                    <span>{item.title}</span>
                    <ArrowUpRight className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
