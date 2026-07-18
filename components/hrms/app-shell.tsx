"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import {
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Search,
  Users, Building2, MapPin, Briefcase, FileText, Clock, Calendar,
  DollarSign, GraduationCap, Package, Megaphone, BarChart3, Settings,
  Shield, GitPullRequest, Sparkles, Bot, Menu, X, PlugZap,
  Wallet,
  ClipboardCheck, UserPlus, CalendarClock, Fingerprint, BarChart4,
  Umbrella
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { NotificationBell } from "@/components/enterprise/notification-bell";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { usePendingApprovalsCount } from "@/lib/hooks/use-pending-approvals-count";
import { useExpiringInsuranceCount } from "@/lib/hooks/use-expiring-insurance-count";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/hrms/theme-toggle";
import { QuickSearchModal } from "@/components/hrms/quick-search-modal";
import { useThemeStore } from "@/store/theme";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n";

interface AppShellProps {
  children: ReactNode;
  companyLogo?: string | null;
  locale: Locale;
  dictionary: Dictionary;
}

type NavKey = keyof Dictionary["nav"];

const navItems: Array<{ href: string; labelKey: NavKey; icon: typeof LayoutDashboard; group: string; resource: string | string[] }> = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, group: "dashboardAnalytics", resource: "dashboard" },

  { href: "/employees", labelKey: "employees", icon: Users, group: "peopleContracts", resource: "employees" },
  { href: "/branches", labelKey: "departments-branches", icon: MapPin, group: "peopleContracts", resource: ["departments", "branches"] },
  { href: "/hospitals", labelKey: "hospitals", icon: Building2, group: "peopleContracts", resource: ["hospitals", "branches"] },
  { href: "/contracts", labelKey: "contracts", icon: FileText, group: "peopleContracts", resource: ["contracts", "documents"] },
  { href: "/insurance", labelKey: "insurance", icon: Umbrella, group: "peopleContracts", resource: "insurance" },
  { href: "/setup", labelKey: "setup", icon: Briefcase, group: "peopleContracts", resource: ["positions", "employment-types", "nationalities"] },

  { href: "/attendance", labelKey: "attendance", icon: Clock, group: "attendanceShifts", resource: "attendance" },
  { href: "/biometrics", labelKey: "biometrics", icon: Fingerprint, group: "attendanceShifts", resource: "attendance" },
  { href: "/shifts", labelKey: "shifts-management", icon: CalendarClock, group: "attendanceShifts", resource: "shifts" },

  { href: "/leaves", labelKey: "leave", icon: Calendar, group: "requestsLeave", resource: "leave" },
  { href: "/overtime", labelKey: "overtime", icon: Clock, group: "requestsLeave", resource: "overtime" },
  { href: "/approvals", labelKey: "approvals", icon: GitPullRequest, group: "requestsLeave", resource: ["leave", "requests"] },

  { href: "/payroll", labelKey: "payroll", icon: DollarSign, group: "financePayroll", resource: ["payroll", "allowances", "deductions"] },
  { href: "/loans", labelKey: "loans", icon: Wallet, group: "financePayroll", resource: "loans" },

  { href: "/performance", labelKey: "performance", icon: ClipboardCheck, group: "talentAssets", resource: "performance" },
  { href: "/recruitment", labelKey: "recruitment", icon: UserPlus, group: "talentAssets", resource: "recruitment" },
  { href: "/training", labelKey: "training", icon: GraduationCap, group: "talentAssets", resource: "training" },
  { href: "/assets", labelKey: "assets", icon: Package, group: "talentAssets", resource: "assets" },

  { href: "/permissions", labelKey: "permissions", icon: Shield, group: "systemSettings", resource: "permissions" },
  { href: "/integrations/synchronization", labelKey: "integrations-sync", icon: PlugZap, group: "systemSettings", resource: "settings" },
  { href: "/reports", labelKey: "reports", icon: BarChart3, group: "systemSettings", resource: "reports" },
  { href: "/announcements", labelKey: "announcements", icon: Megaphone, group: "systemSettings", resource: ["announcements", "notifications"] },
  { href: "/audit-logs", labelKey: "audit-logs", icon: Shield, group: "systemSettings", resource: "audit-logs" },
  { href: "/settings", labelKey: "settings", icon: Settings, group: "systemSettings", resource: "settings" },
  { href: "/ai-assistant", labelKey: "ai-assistant", icon: Bot, group: "systemSettings", resource: "reports" },
  { href: "/lana-ai", labelKey: "lana-ai", icon: Sparkles, group: "systemSettings", resource: "reports" },
];

const groupOrder = ["dashboardAnalytics", "peopleContracts", "attendanceShifts", "requestsLeave", "financePayroll", "talentAssets", "systemSettings"] as const;
type GroupKey = (typeof groupOrder)[number];
const groupEmoji: Record<GroupKey, string> = {
  dashboardAnalytics: "📊",
  peopleContracts: "👥",
  attendanceShifts: "⏱️",
  requestsLeave: "📅",
  financePayroll: "💰",
  talentAssets: "🎓",
  systemSettings: "⚙️"
};

export function AppShell({ children, companyLogo, locale, dictionary }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { sidebarCollapsed: storedSidebarCollapsed, toggleSidebar, _hasHydrated } = useThemeStore();
  const sidebarCollapsed = _hasHydrated ? storedSidebarCollapsed : false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const prefetchRoute = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  const userRoles = useMemo(() => (session?.user?.roles as string[]) || [], [session?.user?.roles]);
  const userPermissions = useMemo(() => (session?.user?.permissions as string[]) || [], [session?.user?.permissions]);
  const { data: pendingApprovalsCount } = usePendingApprovalsCount(status === "authenticated");
  const canViewInsurance = userRoles.includes("SUPER_ADMIN") || userRoles.includes("HR_MANAGER") || userPermissions.includes("read:insurance") || userPermissions.includes("manage:insurance");
  const { data: expiringInsuranceCount } = useExpiringInsuranceCount(status === "authenticated" && canViewInsurance);

  const handleLogout = useCallback(async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  }, []);

  const isActive = useCallback((href: string) => pathname.startsWith(href), [pathname]);

  const groupedNav = useMemo(() => {
    const result: Record<string, typeof navItems> = {};
    const roleSet = new Set(userRoles);
    const isSuperAdmin = roleSet.has("SUPER_ADMIN");
    const isSuperAdminOrHR = isSuperAdmin || roleSet.has("HR_MANAGER");

    navItems
      .filter((item) => {
        const resources = Array.isArray(item.resource) ? item.resource : [item.resource];
        if (resources.includes("dashboard")) return true;
        if (resources.includes("audit-logs")) return isSuperAdmin;
        if (isSuperAdminOrHR) return true;
        return resources.some((resource) => {
          const hasResourceAccess = resource === "overtime"
            ? userPermissions.includes("manage:overtime")
            : (userPermissions.includes(`read:${resource}`) || userPermissions.includes(`manage:${resource}`));
          return hasResourceAccess && isEnterpriseResourceAllowed(userRoles, resource);
        });
      })
      .forEach((item) => { if (!result[item.group]) result[item.group] = []; result[item.group].push(item); });
    return result;
  }, [userPermissions, userRoles]);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <div className="hidden h-screen w-[284px] shrink-0 border-e border-teal-100/60 bg-white/80 backdrop-blur-xl lg:block dark:border-slate-800/80 dark:bg-slate-950/80" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-16 shrink-0 border-b border-border/80 bg-white/90 dark:bg-slate-950/90" />
          <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/50 text-foreground transition-colors duration-200 dark:bg-slate-950">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Pro Max UI Glassmorphism Sidebar with Soft Mint Accents & Comfortable Spacing */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex h-screen flex-col border-e border-teal-100/70 bg-gradient-to-b from-white/95 via-teal-50/30 to-white/95 shadow-xl shadow-teal-900/5 backdrop-blur-2xl transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:shadow-none lg:!translate-x-0 dark:border-slate-800/80 dark:bg-gradient-to-b dark:from-slate-950/95 dark:via-slate-900/90 dark:to-slate-950/95",
          sidebarCollapsed ? "lg:w-[78px]" : "lg:w-[284px]",
          "w-[284px]",
          mobileMenuOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-teal-100/60 px-4 lg:hidden dark:border-slate-800/80">
          <BrandLogo href="/" size="sm" showText={true} />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl p-2 text-slate-500 hover:bg-teal-50/80 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 py-5 px-3 overflow-y-auto overflow-x-hidden space-y-6">
          {groupOrder.filter((groupKey) => groupedNav[groupKey]?.length).map((groupKey) => {
            const items = groupedNav[groupKey]!;
            return (
            <div key={groupKey} className="space-y-1.5">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2 px-3 mb-2 pt-1">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-teal-500/80 shadow-2xs shadow-teal-500" />
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {dictionary.navGroups[groupKey]} {groupEmoji[groupKey]}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const label = dictionary.nav[item.labelKey];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      onMouseEnter={() => prefetchRoute(item.href)}
                      onFocus={() => prefetchRoute(item.href)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-sm font-bold transition-all duration-300 ease-out border",
                        sidebarCollapsed ? "lg:justify-center lg:px-2.5 lg:py-3" : "",
                        active
                          ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black shadow-lg shadow-teal-600/25 border-teal-500/40 scale-[1.01] dark:from-teal-500 dark:to-emerald-600 dark:text-slate-950 dark:shadow-teal-500/20"
                          : "border-transparent text-slate-600 hover:bg-teal-50/80 hover:text-teal-800 hover:border-teal-100/80 hover:shadow-2xs dark:text-slate-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-200 dark:hover:border-teal-900/40"
                      )}
                      title={sidebarCollapsed ? label : undefined}
                    >
                      <span className="relative inline-flex shrink-0">
                        <Icon className={cn(
                          "h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                          active ? "text-white dark:text-slate-950 drop-shadow-xs" : "text-slate-400 group-hover:text-teal-600 dark:text-slate-500 dark:group-hover:text-teal-400"
                        )} />
                        {item.href === "/approvals" && pendingApprovalsCount ? (
                          <span
                            key={pendingApprovalsCount}
                            className="absolute -top-1.5 -end-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 px-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950 shadow-sm"
                            aria-label={`${pendingApprovalsCount} pending approvals`}
                          >
                            {pendingApprovalsCount > 99 ? "99+" : pendingApprovalsCount}
                          </span>
                        ) : null}
                        {item.href === "/insurance" && expiringInsuranceCount ? (
                          <span
                            key={expiringInsuranceCount}
                            className="absolute -top-1.5 -end-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950 shadow-sm"
                            aria-label={`${expiringInsuranceCount} insurance policies renewing soon`}
                          >
                            {expiringInsuranceCount > 99 ? "99+" : expiringInsuranceCount}
                          </span>
                        ) : null}
                      </span>
                      {(!sidebarCollapsed || mobileMenuOpen) && (
                        <span className="truncate">{label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>

        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="m-3 rounded-3xl border border-teal-200/60 bg-gradient-to-br from-teal-50/90 via-emerald-50/50 to-white/90 p-4 shadow-md shadow-teal-900/5 backdrop-blur-xl dark:border-teal-800/40 dark:from-teal-950/50 dark:via-emerald-950/30 dark:to-slate-900/80">
            <div className="flex items-center gap-2.5 text-teal-900 dark:text-teal-200 font-extrabold text-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/30">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              </div>
              <span>Lana AI Pro Max</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
              مساعد الذكاء الاصطناعي التنفيذي متصل لتحليل البيانات ودعم القرارات الإدارية العليا.
            </p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col h-screen">
      {/* Cleaned Pro Max Header (Smart Search removed per requirement #2) */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-teal-100/60 bg-white/90 shadow-2xs shadow-teal-900/5 backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-slate-950/40">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Toggle mobile sidebar"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl hover:bg-teal-50/80 text-slate-600 hover:text-teal-700 transition-all dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-teal-300 border border-transparent hover:border-teal-200/50"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronLeft className="h-4.5 w-4.5" /> : <ChevronRight className="h-4.5 w-4.5" />}
            </button>
            <BrandLogo
              href="/"
              src={companyLogo}
              size="sm"
              showText={!sidebarCollapsed}
              subtitle=""
              className="font-semibold"
              logoClassName="h-11 w-11"
              titleClassName="text-base"
            />
          </div>

          {/* Right section: Notification Bell, Language, Theme, User Badge, Logout */}
          <div className="flex items-center gap-3 ms-auto">
            <NotificationBell />
            <ClientLanguageToggle variant="ghost" className="hidden sm:inline-flex rounded-xl hover:bg-teal-50/80 dark:hover:bg-slate-900" />
            <ThemeToggle />
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="hidden sm:flex items-center gap-3 pl-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-sm font-black shadow-md shadow-teal-600/20">
                {session.user?.name?.charAt(0) || "👑"}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-black truncate max-w-[150px] text-slate-900 dark:text-slate-100 leading-tight">
                  {session.user?.name}
                </p>
                <div className="flex gap-1 mt-1">
                  {userRoles.slice(0, 2).map((role: string) => (
                    <Badge key={role} variant="secondary" className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border-teal-200/60 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/50">
                      {role === "SUPER_ADMIN" ? "👑 SUPER_ADMIN" : role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 rounded-2xl h-10 w-10 transition-colors"
              aria-label={dictionary.common.signOut}
              title={dictionary.common.signOut}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-8">
        {children}
      </main>
      </div>

      <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
