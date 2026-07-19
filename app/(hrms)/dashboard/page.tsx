import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getRequestDictionary } from "@/lib/i18n-server";
import { CompanyOverview, OverviewSkeleton } from "@/app/(hrms)/analytics/page";
import {
  Users, Building2, GitPullRequest, WalletCards, ShieldCheck, Sparkles,
  ArrowUpRight, Clock3, Activity, CheckCircle2, Hospital, CalendarClock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة التحكم المركزية — Pro Max Executive Hub | Lana HRMS",
  description: "المستشعر الذكي وإدارة الموارد البشرية التنفيذية لمنصات لانا الطبية والتشغيلية."
};

export default async function CentralDashboardPage() {
  const session = await auth().catch(() => null);
  const { locale, dictionary } = await getRequestDictionary().catch(() => ({ locale: "ar" as const, dictionary: {} as any }));

  const quickShortcuts = [
    {
      title: "إدارة الموظفين والعقود",
      description: "سجل الموظفين، العقود، التأمين، وتحديث الملفات الشخصية.",
      href: "/employees",
      icon: Users,
      badge: "دليل الموظفين",
      gradient: "from-teal-600 via-emerald-600 to-teal-700",
      bgLight: "bg-teal-50/70 border-teal-200/80 hover:border-teal-400 dark:bg-teal-950/30 dark:border-teal-800/60"
    },
    {
      title: "مركز الموافقات والطلبات",
      description: "إدارة الإجازات، العمل الإضافي، وسلسلة الاعتمادات التنفيذية.",
      href: "/approvals",
      icon: GitPullRequest,
      badge: "مباشر",
      gradient: "from-amber-500 via-orange-500 to-red-500",
      bgLight: "bg-amber-50/70 border-amber-200/80 hover:border-amber-400 dark:bg-amber-950/30 dark:border-amber-800/60"
    },
    {
      title: "المستشفيات ومواقع التشغيل",
      description: "توزيع الكوادر الطبية والفروع وإحصاءات الحضور الميداني.",
      href: "/hospitals",
      icon: Hospital,
      badge: "القطاع الطبي",
      gradient: "from-primary via-purple-600 to-pink-600",
      bgLight: "bg-primary/70 border-primary/80 hover:border-primary/50 dark:bg-primary/30 dark:border-primary/60"
    },
    {
      title: "مسير الرواتب والمالية",
      description: "إصدار الرواتب الشهرية، السلف، الاستقطاعات، والبدلات.",
      href: "/payroll",
      icon: WalletCards,
      badge: "المالية والرواتب",
      gradient: "from-blue-600 via-cyan-600 to-teal-600",
      bgLight: "bg-blue-50/70 border-blue-200/80 hover:border-blue-400 dark:bg-blue-950/30 dark:border-blue-800/60"
    }
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Pro Max Executive Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/60 p-6 sm:p-8 shadow-xl shadow-teal-900/5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-teal-950/30">
        <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-teal-500/15 to-emerald-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge className="bg-gradient-to-r from-teal-600 to-emerald-600 px-3 py-1 text-xs font-black text-white shadow-sm">
                👑 لوحة التحكم المركزية Pro Max
              </Badge>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>المزامنة والتشغيل الفوري متصل بأعلى كفاءة</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              أهلاً بك، <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-600 to-primary">{session?.user?.name || "الإدارة التنفيذية"}</span>
            </h1>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              مركز التحكم التنفيذي Pro Max لمنصة لانا الطبية؛ رصد لحظي لحركة الكوادر، الاعتمادات، الرواتب، وتكامل بيانات Odoo لحظياً.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/employees?action=create"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-600/25 transition-all hover:scale-105 hover:shadow-xl active:scale-95"
            >
              <Users className="h-4.5 w-4.5" />
              <span>إضافة موظف جديد</span>
            </Link>
            <Link
              href="/attendance"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <CalendarClock className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
              <span>مراقبة الحضور</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Navigation Shortcuts Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
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
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex items-center justify-between">
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
}
