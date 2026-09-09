"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import {
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight,
  Users, Building2, Clock,
  DollarSign, Package, Megaphone, BarChart3, Settings,
  Shield, GitPullRequest, Menu, X, PlugZap, Search,
  CalendarClock, Fingerprint,
  Umbrella, User, Mail, ShieldCheck, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { NotificationBell } from "@/components/enterprise/notification-bell";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { usePendingApprovalsCount } from "@/lib/hooks/use-pending-approvals-count";
import { useExpiringInsuranceCount } from "@/lib/hooks/use-expiring-insurance-count";
import { useSocialInsuranceAlertsCount } from "@/lib/hooks/use-social-insurance-alerts-count";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/hrms/theme-toggle";
import { QuickSearchModal } from "@/components/hrms/quick-search-modal";
import { useThemeStore } from "@/store/theme";
import { cn } from "@/lib/utils";
import { resolveRoleDashboard } from "@/config/auth";
import type { Dictionary, Locale } from "@/lib/i18n";

interface AppShellProps {
  children: ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}

// Flat, explicitly ordered sidebar -- the 16 navigable items requested,
// in the exact order specified (grouping/categories removed). "ملفي" is
// intentionally not in this list: it's rendered as a separate pinned
// overlay trigger at the very end of the sidebar (see ProfileOverlay),
// not a route. The smart assistant additionally gets its own explicit
// authenticated-state guard where it renders, beyond the outer session
// check this whole shell already requires.
const navItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; resource: string | string[] }> = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, resource: "dashboard" },
  { href: "/employees", label: "الموظفون", icon: Users, resource: "employees" },
  { href: "/hospitals", label: "المستشفيات", icon: Building2, resource: "hospitals" },
  { href: "/request-center", label: "الطلبات", icon: GitPullRequest, resource: ["leave", "requests"] },
  { href: "/permissions", label: "الصلاحيات", icon: Shield, resource: "permissions" },
  { href: "/insurance", label: "التأمينات", icon: Umbrella, resource: ["insurance", "social-insurance"] },
  { href: "/attendance", label: "الحضور والورديات", icon: Clock, resource: ["attendance", "shifts"] },
  { href: "/payroll", label: "مسير الرواتب والبدلات", icon: DollarSign, resource: ["payroll", "allowances", "deductions"] },
  { href: "/assets", label: "الأصول والعهد", icon: Package, resource: "assets" },
  { href: "/biometrics", label: "مراقبة البصمة والمواقع", icon: Fingerprint, resource: "attendance" },
  { href: "/overtime", label: "العمل الإضافي", icon: CalendarClock, resource: "overtime" },
  { href: "/reports", label: "التقارير", icon: BarChart3, resource: "reports" },
  { href: "/integrations/synchronization", label: "مزامنة Odoo", icon: PlugZap, resource: "settings" },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone, resource: ["announcements", "notifications"] },
  { href: "/settings", label: "الإعدادات", icon: Settings, resource: "settings" },
];

export function AppShell({ children, dictionary }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { sidebarCollapsed: storedSidebarCollapsed, toggleSidebar, _hasHydrated } = useThemeStore();
  const sidebarCollapsed = _hasHydrated ? storedSidebarCollapsed : false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showProfileOverlay, setShowProfileOverlay] = useState(false);

  const prefetchRoute = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  const userRoles = useMemo(() => (session?.user?.roles as string[]) || [], [session?.user?.roles]);
  const userPermissions = useMemo(() => (session?.user?.permissions as string[]) || [], [session?.user?.permissions]);
  const { data: pendingApprovalsCount } = usePendingApprovalsCount(status === "authenticated");
  const canViewInsurance = userRoles.includes("SUPER_ADMIN") || userRoles.includes("HR_MANAGER") || userPermissions.includes("read:insurance") || userPermissions.includes("manage:insurance");
  const { data: expiringInsuranceCount } = useExpiringInsuranceCount(status === "authenticated" && canViewInsurance);
  const canViewSocialInsurance = userRoles.includes("SUPER_ADMIN") || userRoles.includes("HR_MANAGER") || userPermissions.includes("read:social-insurance") || userPermissions.includes("manage:social-insurance");
  const { data: socialInsuranceAlertsCount } = useSocialInsuranceAlertsCount(status === "authenticated" && canViewSocialInsurance);

  const handleLogout = useCallback(async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  }, []);

  const isActive = useCallback((href: string) => pathname.startsWith(href), [pathname]);

  const isNavItemAllowed = useCallback((item: { resource: string | string[] }) => {
    const resources = Array.isArray(item.resource) ? item.resource : [item.resource];
    const roleSet = new Set(userRoles);
    const isSuperAdminOrHR = roleSet.has("SUPER_ADMIN") || roleSet.has("HR_MANAGER");
    if (resources.includes("dashboard")) return true;
    if (isSuperAdminOrHR) return true;
    return resources.some((resource) => {
      const hasResourceAccess = resource === "overtime"
        ? userPermissions.includes("manage:overtime")
        : (userPermissions.includes(`read:${resource}`) || userPermissions.includes(`manage:${resource}`));
      return hasResourceAccess && isEnterpriseResourceAllowed(userRoles, resource);
    });
  }, [userPermissions, userRoles]);

  // "الرئيسية" always points at the role's OWN dashboard (Employee/Manager/
  // HR/Super Admin each have a distinct one) rather than the hardcoded
  // Central Executive Dashboard every non-super-admin used to land on.
  const homeHref = useMemo(() => resolveRoleDashboard(userRoles), [userRoles]);
  const visibleNavItems = useMemo(
    () => navItems.filter(isNavItemAllowed).map((item) => (item.resource === "dashboard" ? { ...item, href: homeHref } : item)),
    [isNavItemAllowed, homeHref]
  );

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <div className="hidden h-screen w-[272px] shrink-0 bg-[hsl(var(--sidebar-bg))] lg:block" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-16 shrink-0 border-b border-border/80 bg-white dark:bg-slate-950" />
          <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Hybrid design: the sidebar itself is solid, opaque white (no
          transparency/blur) with a soft edge shadow toward the content side
          for a crisp, confident separation -- the glass/blur treatment is
          reserved entirely for cards inside the main content area below, so
          the two surfaces read as deliberately different materials. */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex h-screen flex-col border-e border-white/10 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-foreground))] shadow-xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-auto lg:!translate-x-0",
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-[248px]",
          "w-[248px]",
          mobileMenuOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <BrandLogo href="/" size="sm" showText={!sidebarCollapsed || mobileMenuOpen} textClassName="text-white" subtitleClassName="text-blue-100/60" logoClassName="bg-white text-primary border-white" />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                    sidebarCollapsed ? "lg:justify-center lg:px-2.5" : "",
                    active
                      ? "bg-white font-semibold text-primary shadow-sm"
                      : "text-blue-100/70 hover:bg-white/10 hover:text-white"
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="relative inline-flex shrink-0">
                    <Icon className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-primary" : "text-blue-100/65 group-hover:text-white"
                    )} />
                    {item.href === "/request-center" && pendingApprovalsCount ? (
                      <span
                        key={pendingApprovalsCount}
                        className="absolute -top-1.5 -end-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 px-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950 shadow-sm"
                        aria-label={`${pendingApprovalsCount} طلبات موافقة معلقة`}
                      >
                        {pendingApprovalsCount > 99 ? "99+" : pendingApprovalsCount}
                      </span>
                    ) : null}
                    {item.href === "/insurance" && (expiringInsuranceCount || socialInsuranceAlertsCount) ? (
                      <span
                        key={expiringInsuranceCount}
                        className="absolute -top-1.5 -end-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950 shadow-sm"
                        aria-label={`${Number(expiringInsuranceCount || 0) + Number(socialInsuranceAlertsCount || 0)} تنبيهات تأمين`}
                      >
                        {Number(expiringInsuranceCount || 0) + Number(socialInsuranceAlertsCount || 0) > 99 ? "99+" : Number(expiringInsuranceCount || 0) + Number(socialInsuranceAlertsCount || 0)}
                      </span>
                    ) : null}
                  </span>
                  {(!sidebarCollapsed || mobileMenuOpen) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}

          </div>
        </div>

        {/* #17 ملفي -- pinned last, opens the Profile Overlay in place
            instead of navigating; the admin work area stays mounted and
            visible behind it. */}
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setShowProfileOverlay(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-100/75 transition-colors hover:bg-white/10 hover:text-white",
              sidebarCollapsed ? "lg:justify-center lg:px-2.5" : ""
            )}
            title={sidebarCollapsed ? "ملفي" : undefined}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-bold text-white">
              {session.user?.name?.charAt(0) || <User className="h-4 w-4" />}
            </span>
            {(!sidebarCollapsed || mobileMenuOpen) && <span className="truncate">ملفي</span>}
          </button>
        </div>
      </aside>

      <ProfileOverlay
        open={showProfileOverlay}
        onClose={() => setShowProfileOverlay(false)}
        userName={session.user?.name}
        userEmail={session.user?.email}
        userRoles={userRoles}
        employeeProfile={session.user?.employeeProfile ?? null}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col h-screen">
      {/* Shared application header */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="تبديل القائمة الجانبية للجوال"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleSidebar}
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
              aria-label={sidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
            >
              {sidebarCollapsed ? <ChevronLeft className="h-4.5 w-4.5" /> : <ChevronRight className="h-4.5 w-4.5" />}
            </button>
            <button type="button" onClick={() => setSearchOpen(true)} className="hidden h-10 min-w-[260px] items-center gap-2 rounded-xl border border-border bg-muted/45 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card lg:flex">
              <Search className="h-4 w-4" />
              <span>البحث في النظام</span>
              <kbd className="ms-auto rounded-md border bg-card px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
            </button>
          </div>

          {/* Right section: Notification Bell, Language, Theme, User Badge, Logout */}
          <div className="flex items-center gap-3 ms-auto">
            <NotificationBell />
            <ClientLanguageToggle variant="ghost" className="hidden sm:inline-flex rounded-xl hover:bg-primary/10 dark:hover:bg-slate-900" />
            <ThemeToggle />
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="hidden sm:flex items-center gap-3 pl-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {session.user?.name?.charAt(0) || "م"}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-black truncate max-w-[150px] text-slate-900 dark:text-slate-100 leading-tight">
                  {session.user?.name}
                </p>
                <div className="flex gap-1 mt-1">
                  {userRoles.slice(0, 1).map((role: string) => (
                    <Badge key={role} variant="secondary" className="border-0 bg-muted px-2 py-0 text-[9px] font-medium text-muted-foreground">
                      {role === "SUPER_ADMIN" ? "مدير النظام" : role}
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

      <main className="hrms-workspace relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 lg:p-6">
        {children}
      </main>
      </div>

      <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

/**
 * "ملفي" Profile Overlay: a modal floated on top of the admin dashboard --
 * the dashboard/work area stays mounted and dimly visible behind the
 * backdrop (never unmounted, never navigated away from), matching the
 * "keep the admin work context open in the background" requirement.
 */
function ProfileOverlay({
  open,
  onClose,
  userName,
  userEmail,
  userRoles,
  employeeProfile,
  onLogout
}: {
  open: boolean;
  onClose: () => void;
  userName?: string | null;
  userEmail?: string | null;
  userRoles: string[];
  employeeProfile?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    profilePhotoUrl: string | null;
    positionTitle: string | null;
    departmentName: string | null;
  } | null;
  onLogout: () => void;
}) {
  if (!open) return null;
  const initials = userName?.charAt(0) || "?";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl shadow-black/30 animate-in zoom-in-95 duration-200"
      >
        {/* البطاقة البنفسجية: the purple/violet gradient profile card. */}
        <div className="relative bg-gradient-to-br from-secondary via-secondary to-primary p-6 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-4 end-4 grid h-8 w-8 place-items-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-black backdrop-blur-sm ring-2 ring-white/30">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black truncate">{userName || "المستخدم"}</p>
              <div className="flex items-center gap-1.5 mt-1 text-white/80 text-xs font-semibold truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{userEmail || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {userRoles.slice(0, 3).map((role) => (
              <span key={role} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black">
                <ShieldCheck className="h-3 w-3" />
                {role === "SUPER_ADMIN" ? "مدير النظام" : role}
              </span>
            ))}
          </div>
        </div>

        {/* الملف الوظيفي: real Employee data when this account is linked to
            one, or an honest "not linked" notice -- never fabricated data. */}
        {employeeProfile ? (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                  {employeeProfile.positionTitle || "بدون مسمى وظيفي"}
                </p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {employeeProfile.departmentName || "بدون قسم"} · رقم الموظف {employeeProfile.employeeNumber}
                </p>
              </div>
            </div>
            <Link
              href={`/employees/${employeeProfile.id}`}
              onClick={onClose}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/8 transition-colors"
            >
              <span>عرض ملفي الوظيفي الكامل</span>
            </Link>
          </div>
        ) : (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-start gap-2.5 rounded-2xl border bg-slate-50 p-3 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="text-xs font-bold leading-relaxed">حساب إداري</p>
                <p className="mt-1 text-[11px] text-muted-foreground">هذا الحساب مخصص لإدارة النظام ولا يحتاج إلى ملف موظف.</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-primary/8 hover:text-primary transition-colors dark:text-slate-300 dark:hover:bg-primary/10"
          >
            <Settings className="h-4.5 w-4.5" />
            <span>الإعدادات</span>
          </Link>
          <button
            type="button"
            onClick={() => { onClose(); onLogout(); }}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}
