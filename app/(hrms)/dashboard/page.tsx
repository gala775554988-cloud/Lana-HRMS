import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getRequestDictionary } from "@/lib/i18n-server";
import { CompanyOverview, OverviewSkeleton } from "@/app/(hrms)/analytics/page";
import { getExecutiveHubOrgGroups, type OrgGroupCard } from "@/lib/enterprise/dashboard-org-groups";
import {
  Users, ArrowUpRight, Activity, Hospital, Wrench, Syringe, Landmark, CalendarClock, AlertTriangle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Brand gradient (emerald -> gold -> slate-blue), the dashboard's own fixed
// identity -- kept as hardcoded hex literals (not the shared --primary
// token) so this page's look never depends on what --primary resolves to
// elsewhere in the app. Kept as a literal gradient string since Tailwind
// has no single utility for a precise 3-stop percentage gradient.
const BRAND_GRADIENT = "linear-gradient(90deg, #1F8A5F 0%, #F2B366 55%, #9CA8B0 100%)";

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
    const orgGroups = await getExecutiveHubOrgGroups().catch(() => null);

    const orgCards: Array<{
      key: string; title: string; description: string; icon: LucideIcon; badge: string; color: string;
      bgLight: string; data: OrgGroupCard;
    }> = [
      {
        key: "hospitals",
        title: "المستشفيات",
        description: "توزيع الكوادر الطبية على مواقع المستشفيات الفعلية.",
        icon: Hospital,
        badge: "القطاع الطبي",
        color: "#1F8A5F",
        bgLight: "bg-emerald-50 border-emerald-200 hover:border-emerald-400 dark:bg-slate-900 dark:border-emerald-900",
        data: orgGroups?.hospitals ?? { total: 0, items: [], href: "/hospitals" }
      },
      {
        key: "operations",
        title: "التشغيل",
        description: "المشاريع والخدمات اللوجستية ومحطات المعالجة والبيئة ومكافحة العدوى.",
        icon: Wrench,
        badge: "العمليات التشغيلية",
        color: "#F2B366",
        bgLight: "bg-amber-50 border-amber-200 hover:border-amber-400 dark:bg-slate-900 dark:border-amber-900",
        data: orgGroups?.operations ?? { total: 0, items: [], href: "/branches?tab=departments" }
      },
      {
        key: "medical-supplies",
        title: "المستلزمات الطبية",
        description: "الأجهزة والمستلزمات الطبية، الصيانة، والمشتريات الطبية.",
        icon: Syringe,
        badge: "الإمداد الطبي",
        color: "#E2955A",
        bgLight: "bg-orange-50 border-orange-200 hover:border-orange-400 dark:bg-slate-900 dark:border-orange-900",
        data: orgGroups?.medicalSupplies ?? { total: 0, items: [], href: "/branches?tab=departments" }
      },
      {
        key: "main-administration",
        title: "الإدارة الرئيسية",
        description: "الإدارة والمالية وإدارة التوريد وتقنية المعلومات والمراجع.",
        icon: Landmark,
        badge: "الإدارة المركزية",
        color: "#9CA8B0",
        bgLight: "bg-slate-50 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:border-slate-700",
        data: orgGroups?.mainAdministration ?? { total: 0, items: [], href: "/branches?tab=departments" }
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
                <Badge className="bg-white px-3 py-1 text-xs font-black shadow-sm hover:bg-white" style={{ color: "#146C48" }}>
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
                style={{ color: "#146C48" }}
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

        {/* Organizational Units Grid (real Hospital/Department data) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5" style={{ color: "#1F8A5F" }} />
              <span>الوحدات التنظيمية الرئيسية</span>
            </h2>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">أعداد حية من قاعدة البيانات</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orgCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className={`group relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card.bgLight}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                      style={{ backgroundColor: card.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-extrabold border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                      {card.badge}
                    </Badge>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{card.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{card.data.total.toLocaleString("ar-SA")}</span>
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">موظف</span>
                  </div>
                  <div className="mt-3 max-h-36 space-y-0.5 overflow-y-auto rounded-xl bg-white p-1.5 dark:bg-slate-950">
                    {card.data.items.length === 0 ? (
                      <p className="px-2 py-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">لا توجد بيانات مطابقة بعد</p>
                    ) : (
                      card.data.items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white dark:text-slate-400 dark:hover:bg-slate-900"
                        >
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0 font-black text-slate-800 dark:text-slate-200">{item.count.toLocaleString("ar-SA")}</span>
                        </Link>
                      ))
                    )}
                  </div>
                  <Link
                    href={card.data.href}
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black text-white shadow-sm transition-transform group-hover:scale-[1.02]"
                    style={{ backgroundColor: card.color }}
                  >
                    <span>فتح القسم</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Company Overview (KPIs, Live Metrics) */}
        <Suspense fallback={<OverviewSkeleton />}>
          <CompanyOverview locale={locale || "ar"} dictionary={dictionary || {}} showCharts={false} showAiSummary={false} />
        </Suspense>
      </div>
    );
  } catch (err: any) {
    return <DiagnosticConfessionBox err={err} location="CentralDashboardPage (/dashboard)" />;
  }
}
