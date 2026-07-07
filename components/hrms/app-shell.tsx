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
  Shield, GitPullRequest
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { NotificationBell } from "@/components/enterprise/notification-bell";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/hrms/theme-toggle";
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
  { href: "/payroll-runs", label: "الرواتب", icon: DollarSign, group: "ops", resource: "payroll" },
  { href: "/performance", label: "الأداء", icon: GraduationCap, group: "ops", resource: "performance" },
  { href: "/training", label: "التدريب", icon: GraduationCap, group: "ops", resource: "training" },
  { href: "/assets", label: "الأصول", icon: Package, group: "ops", resource: "assets" },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone, group: "admin", resource: "announcements" },
  { href: "/reports", label: "التقارير", icon: BarChart3, group: "admin", resource: "reports" },
  { href: "/audit-logs", label: "سجل التدقيق", icon: Shield, group: "admin", resource: "audit-logs" },
  { href: "/settings", label: "الإعدادات", icon: Settings, group: "admin", resource: "settings" },
];

const groups: Record<string, string> = { main: "الرئيسية", people: "الأفراد", ops: "العمليات", admin: "الإدارة" };

export function AppShell({ children, companyLogo }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { sidebarCollapsed, toggleSidebar, _hasHydrated } = useThemeStore();
  const userRoles = useMemo(() => (session?.user?.roles as string[]) || [], [session?.user?.roles]);
  const userPermissions = useMemo(() => (session?.user?.permissions as string[]) || [], [session?.user?.permissions]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleLogout = useCallback(async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/dashboard";
    return pathname.startsWith(href);
  }, [pathname]);

  const groupedNav = useMemo(() => {
    const result: Record<string, typeof navItems> = {};
    navItems
      .filter((item) => userPermissions.includes(`read:${item.resource}`) && isEnterpriseResourceAllowed(userRoles, item.resource))
      .forEach((item) => { if (!result[item.group]) result[item.group] = []; result[item.group].push(item); });
    return result;
  }, [userPermissions, userRoles]);

  // Show loading while session is loading OR store hasn't hydrated
  if (status === "loading" || !_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <BrandLogo
              href="/"
              src={companyLogo}
              size="sm"
              showText={!sidebarCollapsed}
              subtitle=""
              className="font-semibold"
              logoClassName="h-12 w-12"
              titleClassName="text-base"
            />
          </div>
          <div className="hidden md:flex flex-1 max-w-md items-center mx-auto">
            <button className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Search className="h-4 w-4" /><span>بحث...</span>
              <kbd className="mr-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ClientLanguageToggle variant="ghost" className="hidden sm:inline-flex" />
            <ThemeToggle />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{session.user?.name?.charAt(0) || "U"}</div>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium truncate max-w-[120px]">{session.user?.name}</p>
                <div className="flex gap-1">{userRoles.slice(0, 2).map((role: string) => (<Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0">{role}</Badge>))}</div>
              </div>
            </div>
            <Button onClick={handleLogout} variant="ghost" size="icon" aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className={cn("hidden lg:flex flex-col border-l bg-sidebar border-sidebar-border", "sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden", "transition-all duration-300 ease-in-out", sidebarCollapsed ? "w-[72px]" : "w-[280px]")}>
          <div className="flex-1 py-4">
            {Object.entries(groupedNav).map(([groupKey, items]) => (
              <div key={groupKey} className="mb-2">
                {!sidebarCollapsed && <p className="px-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{groups[groupKey]}</p>}
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} className={cn("sidebar-link mx-2", sidebarCollapsed ? "justify-center px-2" : "", active && "active")} title={sidebarCollapsed ? item.label : undefined}>
                      <Icon className="h-4.5 w-4.5 shrink-0" />{!sidebarCollapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

        </aside>
        <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
