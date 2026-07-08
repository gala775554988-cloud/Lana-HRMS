"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import {
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Search,
  Users, Building2, MapPin, Briefcase, FileText, Clock, Calendar,
  DollarSign, GraduationCap, Package, Megaphone, BarChart3, Settings,
  Shield, GitPullRequest, Sparkles, Menu, X, PlugZap
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

interface AppShellProps {
  children: ReactNode;
  companyLogo?: string | null;
}

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard, group: "main", resource: "dashboard" },
  { href: "/request-center", label: "استقبال الطلبات", icon: GitPullRequest, group: "main", resource: "leave" },
  { href: "/employees", label: "الموظفون", icon: Users, group: "people", resource: "employees" },
  { href: "/departments", label: "الإدارات", icon: Building2, group: "people", resource: "departments" },
  { href: "/branches", label: "الفروع", icon: MapPin, group: "people", resource: "branches" },
  { href: "/hospitals", label: "المستشفيات", icon: Building2, group: "people", resource: "employees" },
  { href: "/positions", label: "المناصب", icon: Briefcase, group: "people", resource: "positions" },
  { href: "/contracts", label: "العقود", icon: FileText, group: "people", resource: "contracts" },
  { href: "/attendance", label: "الحضور", icon: Clock, group: "ops", resource: "attendance" },
  { href: "/leave-requests", label: "الإجازات", icon: Calendar, group: "ops", resource: "leave" },
  { href: "/overtime", label: "الأوفر تايم", icon: Clock, group: "ops", resource: "overtime" },
  { href: "/payroll-runs", label: "الرواتب", icon: DollarSign, group: "ops", resource: "payroll" },
  { href: "/performance", label: "الأداء", icon: GraduationCap, group: "ops", resource: "performance" },
  { href: "/training", label: "التدريب", icon: GraduationCap, group: "ops", resource: "training" },
  { href: "/assets", label: "الأصول", icon: Package, group: "ops", resource: "assets" },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone, group: "admin", resource: "announcements" },
  { href: "/reports", label: "التقارير", icon: BarChart3, group: "admin", resource: "reports" },
  { href: "/integrations", label: "ERP Integrations", icon: PlugZap, group: "admin", resource: "settings" },
  { href: "/enterprise-suite", label: "Enterprise Suites", icon: Briefcase, group: "admin", resource: "settings" },
  { href: "/enterprise-production", label: "Production Centers", icon: BarChart3, group: "admin", resource: "settings" },
  { href: "/phase2-production", label: "Phase 2 Enterprise", icon: Briefcase, group: "admin", resource: "settings" },
  { href: "/enterprise-erp", label: "Enterprise ERP", icon: Building2, group: "admin", resource: "settings" },
  { href: "/infra", label: "Infrastructure", icon: PlugZap, group: "admin", resource: "settings" },
  { href: "/saas-platform", label: "SaaS Platform", icon: DollarSign, group: "admin", resource: "settings" },
  { href: "/lana-ai", label: "Lana AI", icon: Sparkles, group: "admin", resource: "reports" },
  { href: "/audit-logs", label: "سجل التدقيق", icon: Shield, group: "admin", resource: "audit-logs" },
  { href: "/system-settings", label: "إعدادات النظام", icon: Settings, group: "admin", resource: "settings" },
  { href: "/administration", label: "الصلاحيات والإدارة", icon: Shield, group: "admin", resource: "permissions" },
];

const groups: Record<string, string> = { main: "الرئيسية", people: "الأفراد", ops: "العمليات", admin: "الإدارة" };

export function AppShell({ children, companyLogo }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { sidebarCollapsed, toggleSidebar, _hasHydrated } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const userRoles = useMemo(() => (session?.user?.roles as string[]) || [], [session?.user?.roles]);
  const userPermissions = useMemo(() => (session?.user?.permissions as string[]) || [], [session?.user?.permissions]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Global shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/dashboard";
    return pathname.startsWith(href);
  }, [pathname]);

  const groupedNav = useMemo(() => {
    const result: Record<string, typeof navItems> = {};
    const roleSet = new Set(userRoles);
    const isSuperAdminOrHR = roleSet.has("SUPER_ADMIN") || roleSet.has("HR_MANAGER");

    navItems
      .filter((item) => {
        if (isSuperAdminOrHR) return true;
        const hasResourceAccess = item.resource === "overtime"
          ? userPermissions.includes("manage:overtime")
          : (userPermissions.includes(`read:${item.resource}`) || userPermissions.includes(`manage:${item.resource}`));
        return hasResourceAccess && isEnterpriseResourceAllowed(userRoles, item.resource);
      })
      .forEach((item) => { if (!result[item.group]) result[item.group] = []; result[item.group].push(item); });
    return result;
  }, [userPermissions, userRoles]);

  if (status === "loading" || !_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg shadow-primary/20" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">جاري تحميل نظام Lana HRMS...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#111827] dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      <header className="sticky top-0 z-30 border-b border-[#E5E7EB]/80 bg-white/90 shadow-xs shadow-slate-200/60 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-slate-950/40">
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

          {/* Quick Search Bar Trigger */}
          <div className="hidden md:flex flex-1 max-w-md items-center mx-auto">
            <button
              onClick={() => setSearchOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F5F7FB] px-4 py-2.5 text-sm text-[#6B7280] shadow-inner shadow-white/80 transition-all duration-200 hover:border-[#6D6AF8]/60 hover:bg-white hover:text-[#2E2A8C] hover:shadow-md hover:shadow-[#2E2A8C]/5 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none dark:hover:border-[#6D6AF8]/50 dark:hover:bg-slate-900 dark:hover:text-indigo-300"
            >
              <Search className="h-4 w-4 text-[#6D6AF8] transition-transform group-hover:scale-110" />
              <span className="font-medium">البحث الذكي في النظام...</span>
              <kbd className="mr-auto flex items-center gap-0.5 rounded-lg border border-[#E5E7EB] bg-white px-2 py-0.5 text-[10px] font-bold font-mono text-[#6B7280] shadow-2xs group-hover:border-indigo-200 group-hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              aria-label="بحث"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <ClientLanguageToggle variant="ghost" className="hidden sm:inline-flex" />
            <ThemeToggle />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2.5 pl-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2E2A8C] to-[#6D6AF8] text-white text-xs font-bold shadow-md shadow-indigo-500/20">
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
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-slate-200/80 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:shadow-none lg:translate-x-0 dark:border-slate-800 dark:bg-slate-950",
            sidebarCollapsed ? "lg:w-[76px]" : "lg:w-[280px]",
            "w-[280px]",
            mobileMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          )}
        >
          {/* Mobile header inside sidebar */}
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
            {Object.entries(groupedNav).map(([groupKey, items]) => (
              <div key={groupKey} className="px-2">
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {groups[groupKey]}
                  </p>
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "group flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all duration-200",
                          sidebarCollapsed ? "lg:justify-center lg:px-2" : "",
                          active
                            ? "bg-[#2E2A8C] text-white shadow-md shadow-indigo-900/25 dark:bg-[#6D6AF8] dark:text-slate-950 dark:shadow-indigo-500/20"
                            : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon className={cn(
                          "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                          active ? "text-white dark:text-slate-950" : "text-slate-400 group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-400"
                        )} />
                        {(!sidebarCollapsed || mobileMenuOpen) && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar bottom status / Lana AI widget */}
          {(!sidebarCollapsed || mobileMenuOpen) && (
            <div className="m-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 p-3.5 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-purple-950/20">
              <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                <Sparkles className="h-4 w-4 text-[#6D6AF8] animate-pulse" />
                <span>Lana AI Assistant</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                مساعد الذكاء الاصطناعي متصل لتحليل البيانات ودعم قرارات الإدارة.
              </p>
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 p-4 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
