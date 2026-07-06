"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import {
  Bell, LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Search,
  Users, Building2, MapPin, Briefcase, FileText, Clock, Calendar,
  DollarSign, GraduationCap, Package, Megaphone, BarChart3, Settings,
  Shield, UserCheck, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/hrms/theme-toggle";
import { useThemeStore } from "@/store/theme";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  companyLogo?: string | null;
}

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard, group: "main" },
  { href: "/employees", label: "الموظفون", icon: Users, group: "people" },
  { href: "/departments", label: "الإدارات", icon: Building2, group: "people" },
  { href: "/branches", label: "الفروع", icon: MapPin, group: "people" },
  { href: "/positions", label: "المناصب", icon: Briefcase, group: "people" },
  { href: "/contracts", label: "العقود", icon: FileText, group: "people" },
  { href: "/attendance", label: "الحضور", icon: Clock, group: "ops" },
  { href: "/leave-requests", label: "الإجازات", icon: Calendar, group: "ops" },
  { href: "/payroll-runs", label: "الرواتب", icon: DollarSign, group: "ops" },
  { href: "/performance", label: "الأداء", icon: GraduationCap, group: "ops" },
  { href: "/training", label: "التدريب", icon: GraduationCap, group: "ops" },
  { href: "/assets", label: "الأصول", icon: Package, group: "ops" },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone, group: "admin" },
  { href: "/reports", label: "التقارير", icon: BarChart3, group: "admin" },
  { href: "/audit-logs", label: "سجل التدقيق", icon: Shield, group: "admin" },
  { href: "/settings", label: "الإعدادات", icon: Settings, group: "admin" },
];

const groups: Record<string, string> = { main: "الرئيسية", people: "الأفراد", ops: "العمليات", admin: "الإدارة" };

export function AppShell({ children, companyLogo }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const { sidebarCollapsed, toggleSidebar } = useThemeStore();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data?.user) setSession(data);
        else router.push("/login");
      } catch { router.push("/login"); }
    };
    fetchSession();
  }, [router]);

  const handleLogout = async () => { await signOut({ redirect: true, callbackUrl: "/login" }); };

  const isActive = useCallback((href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/dashboard";
    return pathname.startsWith(href);
  }, [pathname]);

  const groupedNav = useMemo(() => {
    const result: Record<string, typeof navItems> = {};
    navItems.forEach((item) => { if (!result[item.group]) result[item.group] = []; result[item.group].push(item); });
    return result;
  }, []);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const userRoles = (session.user?.roles as string[]) || [];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <Link href="/" className="flex items-center gap-2.5 font-semibold" aria-label="Lana HRMS">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="h-8 w-auto rounded-lg object-contain max-w-[120px]" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Sparkles className="h-4 w-4" /></div>
              )}
              {!sidebarCollapsed && <span className="text-base">Lana HRMS</span>}
            </Link>
          </div>
          <div className="hidden md:flex flex-1 max-w-md items-center mx-auto">
            <button className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Search className="h-4 w-4" /><span>بحث...</span>
              <kbd className="mr-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -left-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">3</span>
            </Button>
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
          <div className="border-t p-3">
            <Link href="/my" className={cn("sidebar-link", sidebarCollapsed ? "justify-center px-2" : "")} title={sidebarCollapsed ? "بوابتي الشخصية" : undefined}>
              <UserCheck className="h-4.5 w-4.5 shrink-0" />{!sidebarCollapsed && <span>بوابتي الشخصية</span>}
            </Link>
          </div>
        </aside>
        <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
