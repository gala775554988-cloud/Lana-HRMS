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
  ClipboardCheck, UserPlus, CalendarClock, Fingerprint, BarChart4
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { NotificationBell } from "@/components/enterprise/notification-bell";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
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
  // "/analytics" is intentionally not linked here — its KPI overview (without charts)
  // now lives inside the Reports page instead of a dedicated sidebar entry.

  { href: "/employees", labelKey: "employees", icon: Users, group: "peopleContracts", resource: "employees" },
  { href: "/branches", labelKey: "departments-branches", icon: MapPin, group: "peopleContracts", resource: ["departments", "branches"] },
  { href: "/contracts", labelKey: "contracts", icon: FileText, group: "peopleContracts", resource: ["contracts", "documents"] },
  { href: "/setup", labelKey: "setup", icon: Briefcase, group: "peopleContracts", resource: ["positions", "employment-types", "nationalities"] },

  { href: "/attendance", labelKey: "attendance", icon: Clock, group: "attendanceShifts", resource: "attendance" },
  { href: "/biometrics", labelKey: "biometrics", icon: Fingerprint, group: "attendanceShifts", resource: "attendance" },
  { href: "/shifts", labelKey: "shifts-management", icon: CalendarClock, group: "attendanceShifts", resource: "shifts" },

  { href: "/leaves", labelKey: "leave", icon: Calendar, group: "requestsLeave", resource: "leave" },
  { href: "/overtime", labelKey: "overtime", icon: Clock, group: "requestsLeave", resource: "overtime" },
  { href: "/approvals", labelKey: "approvals", icon: GitPullRequest, group: "requestsLeave", resource: "leave" },

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

  // REMOVED: useEffect that redirects to /login on unauthenticated.
  // Rely on middleware.ts for auth protection — it redirects to /login
  // only when genuinely no token exists. AppShell should never kick out
  // a user who passed middleware.

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
        // audit-logs is Super-Admin-only, deliberately excluded from the
        // HR_MANAGER bypass below (unlike every other enterprise resource).
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
        <div className="hidden h-screen w-[280px] shrink-0 border-e border-slate-200/80 bg-white lg:block dark:border-slate-800 dark:bg-slate-950" />
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
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-200">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex h-screen flex-col border-e border-slate-200/80 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:shadow-none lg:!translate-x-0 dark:border-slate-800 dark:bg-slate-950",
          sidebarCollapsed ? "lg:w-[76px]" : "lg:w-[280px]",
          "w-[280px]",
          // !important on the lg override above is required: the bare (no
          // breakpoint) rtl:/ltr: rules below land later in Tailwind's
          // compiled stylesheet than the lg: media-query block, so without
          // !important they'd win the cascade at desktop widths too and
          // push the sidebar off-screen in RTL -- confirmed by inspecting
          // the actual compiled CSS rule order, not just reasoning about it.
          mobileMenuOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4 lg:hidden dark:border-slate-800">
          <BrandLogo href="/" size="sm" showText={true} />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 py-4 overflow-y-auto overflow-x-hidden space-y-4">
          {groupOrder.filter((groupKey) => groupedNav[groupKey]?.length).map((groupKey) => {
            const items = groupedNav[groupKey]!;
            return (
            <div key={groupKey} className="px-2">
              {!sidebarCollapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {dictionary.navGroups[groupKey]} {groupEmoji[groupKey]}
                </p>
              )}
              <div className="space-y-1">
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
                        "group flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all duration-200",
                        sidebarCollapsed ? "lg:justify-center lg:px-2" : "",
                        active
                          ? "bg-primary text-white shadow-md shadow-indigo-900/25 dark:text-slate-950 dark:shadow-indigo-500/20"
                          : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                      )}
                      title={sidebarCollapsed ? label : undefined}
                    >
                      <Icon className={cn(
                        "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                        active ? "text-white dark:text-slate-950" : "text-slate-400 group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-400"
                      )} />
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
          <div className="m-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 p-3.5 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-purple-950/20">
            <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span>Lana AI Assistant</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              مساعد الذكاء الاصطناعي متصل لتحليل البيانات ودعم قرارات الإدارة.
            </p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col h-screen">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border/80 bg-white/90 shadow-xs shadow-slate-200/60 backdrop-blur-xl dark:bg-slate-950/90 dark:shadow-slate-950/40">
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
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors text-slate-600 dark:text-slate-400"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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

          <div className="hidden md:flex flex-1 max-w-md items-center mx-auto">
            <button
              onClick={() => setSearchOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground shadow-inner shadow-white/80 transition-all duration-200 hover:border-primary/60 hover:bg-white hover:text-primary hover:shadow-md hover:shadow-primary/5 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none dark:hover:border-primary/50 dark:hover:bg-slate-900 dark:hover:text-indigo-300"
            >
              <Search className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
              <span className="font-medium">{dictionary.common.smartSearchPlaceholder}</span>
              <kbd className="ms-auto flex items-center gap-0.5 rounded-lg border border-border bg-white px-2 py-0.5 text-[10px] font-bold font-mono text-muted-foreground shadow-2xs group-hover:border-indigo-200 group-hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              aria-label={dictionary.common.search}
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <ClientLanguageToggle variant="ghost" className="hidden sm:inline-flex" />
            <ThemeToggle />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2.5 pl-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
                {session.user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-bold truncate max-w-[130px] text-slate-900 dark:text-slate-100 leading-tight">
                  {session.user?.name}
                </p>
                <div className="flex gap-1 mt-0.5">
                  {userRoles.slice(0, 2).map((role: string) => (
                    <Badge key={role} variant="secondary" className="text-[9px] font-extrabold px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/50">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 rounded-xl"
              aria-label={dictionary.common.signOut}
              title={dictionary.common.signOut}
            >
              <LogOut className="h-4.5 w-4.5" />
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
