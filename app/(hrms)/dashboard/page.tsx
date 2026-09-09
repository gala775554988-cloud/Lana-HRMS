import { Suspense } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building2,
  CalendarCheck2,
  Clock3,
  Hospital,
  Landmark,
  Plus,
  Syringe,
  Users,
  WalletCards,
  Wrench
} from "lucide-react";
import { auth } from "@/auth";
import { getRequestDictionary } from "@/lib/i18n-server";
import { CompanyOverview, OverviewSkeleton } from "@/app/(hrms)/analytics/page";
import { getExecutiveHubOrgGroups, type OrgGroupCard } from "@/lib/enterprise/dashboard-org-groups";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة التحكم",
  description: "نظرة شاملة على الموارد البشرية والعمليات اليومية."
};

type OrganizationCard = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  data: OrgGroupCard;
};

const quickActions = [
  { href: "/employees?action=create", label: "إضافة موظف", icon: Plus },
  { href: "/request-center", label: "مراجعة الطلبات", icon: CalendarCheck2 },
  { href: "/attendance", label: "متابعة الحضور", icon: Clock3 },
  { href: "/payroll", label: "مسير الرواتب", icon: WalletCards }
];

export default async function CentralDashboardPage() {
  const [session, requestData, orgGroups] = await Promise.all([
    auth().catch(() => null),
    getRequestDictionary().catch(() => ({ locale: "ar" as const, dictionary: {} as never })),
    getExecutiveHubOrgGroups().catch(() => null)
  ]);

  const orgCards: OrganizationCard[] = [
    {
      key: "hospitals",
      title: "المستشفيات",
      description: "توزيع الموظفين على المستشفيات والمواقع الطبية.",
      icon: Hospital,
      data: orgGroups?.hospitals ?? { total: 0, items: [], href: "/hospitals" }
    },
    {
      key: "operations",
      title: "التشغيل",
      description: "المشاريع والخدمات التشغيلية واللوجستية.",
      icon: Wrench,
      data: orgGroups?.operations ?? { total: 0, items: [], href: "/branches?tab=departments" }
    },
    {
      key: "medical-supplies",
      title: "المستلزمات الطبية",
      description: "الأجهزة والصيانة والمشتريات الطبية.",
      icon: Syringe,
      data: orgGroups?.medicalSupplies ?? { total: 0, items: [], href: "/branches?tab=departments" }
    },
    {
      key: "main-administration",
      title: "الإدارة الرئيسية",
      description: "الإدارات المركزية والمالية والتقنية.",
      icon: Landmark,
      data: orgGroups?.mainAdministration ?? { total: 0, items: [], href: "/branches?tab=departments" }
    }
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="h-1 bg-primary" />
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">لوحة العمل اليومية</p>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              مرحبًا، {session?.user?.name || "مرحبًا بك"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              هنا ملخص القوى العاملة والطلبات والحضور. ابدأ من إجراء سريع أو استعرض التفاصيل أدناه.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link href="/employees?action=create" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              إضافة موظف
            </Link>
            <Link href="/employees" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              <Users className="h-4 w-4 text-primary" />
              دليل الموظفين
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="quick-actions-title" className="text-base font-bold">إجراءات سريعة</h2>
          <span className="text-xs text-muted-foreground">العمليات الأكثر استخدامًا</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/30">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold">{action.label}</span>
                <ArrowLeft className="ms-auto h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:rotate-0 ltr:rotate-180" />
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="organization-title">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 id="organization-title" className="text-base font-bold">الوحدات التنظيمية</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">بيانات مباشرة من سجلات الموظفين</p>
          </div>
          <Link href="/branches" className="text-xs font-semibold text-primary hover:underline">إدارة الهيكل التنظيمي</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {orgCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.key} className="overflow-hidden border-border shadow-[var(--shadow-card)] transition-colors hover:border-primary/30">
                <CardHeader className="flex-row items-start justify-between space-y-0 p-5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                    <div>
                      <CardTitle className="text-sm font-bold">{card.title}</CardTitle>
                      <Badge variant="secondary" className="mt-1 border-0 px-2 py-0 text-[10px] font-medium">{card.data.total.toLocaleString("ar-SA")} موظف</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <p className="min-h-10 text-xs leading-5 text-muted-foreground">{card.description}</p>
                  <div className="mt-3 space-y-1 border-t border-border pt-3">
                    {card.data.items.slice(0, 3).map((item) => (
                      <Link key={item.id} href={item.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                        <span className="truncate">{item.name}</span>
                        <span className="font-semibold text-foreground">{item.count.toLocaleString("ar-SA")}</span>
                      </Link>
                    ))}
                    {card.data.items.length === 0 ? <p className="py-2 text-xs text-muted-foreground">لا توجد بيانات مسجلة</p> : null}
                  </div>
                  <Link href={card.data.href} className="mt-3 flex items-center justify-between rounded-lg text-xs font-semibold text-primary hover:underline">
                    عرض التفاصيل
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="overview-title">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 id="overview-title" className="text-base font-bold">نظرة عامة</h2>
        </div>
        <Suspense fallback={<OverviewSkeleton />}>
          <CompanyOverview locale={requestData.locale} dictionary={requestData.dictionary} showCharts={false} showAiSummary={false} />
        </Suspense>
      </section>
    </div>
  );
}
