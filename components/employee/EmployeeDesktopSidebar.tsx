'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';
import {
  LayoutDashboard, Users, GitPullRequest, DollarSign,
  Shield, PlugZap, BarChart3, FileText, Clock, Building2, MapPin
} from 'lucide-react';

export function EmployeeDesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { home, groups } = useEmployeeNavItems();

  const handleIntent = (href: string) => router.prefetch(href);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Check if user has any administrative or HR responsibility
  const userRoles = (session?.user?.roles as string[]) || [];
  const isExecutiveOrManager = userRoles.some((r) =>
    ["SUPER_ADMIN", "HR_MANAGER", "DIRECT_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "PAYROLL_OFFICER", "ADMIN"].includes(r) ||
    r.includes("HR") || r.includes("ADMIN") || r.includes("MANAGER")
  );

  const NavLink = ({ item, emphasized = false }: { item: EmployeeNavItem; emphasized?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        prefetch={true}
        onMouseEnter={() => handleIntent(item.href)}
        onFocus={() => handleIntent(item.href)}
        className={cn(
          'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 will-change-transform hover:-translate-y-0.5 active:scale-[0.985] border border-transparent',
          active
            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-black shadow-md shadow-teal-500/25 border-teal-400/40'
            : emphasized
            ? 'text-slate-800 bg-teal-50/60 hover:bg-teal-100 hover:text-teal-900 dark:text-slate-200 dark:bg-slate-900/60'
            : 'text-slate-700 dark:text-slate-300 hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-300'
        )}
      >
        <span className="relative inline-flex shrink-0">
          <Icon className="h-4.5 w-4.5" />
          {item.badge ? (
            <span
              key={item.badge}
              className="absolute -top-1.5 -end-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-white dark:ring-slate-900 shadow-sm"
              aria-label={`${item.badge} pending approvals`}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div
      style={{ background: "var(--sidebar-gradient, linear-gradient(180deg, #FFFFFF 0%, #EAF8F6 50%, #F4FCFA 100%))" }}
      className="flex flex-col border border-teal-200/60 dark:border-teal-800/60 text-slate-800 dark:text-slate-100 shadow-2xl shadow-teal-900/10 backdrop-blur-2xl rounded-3xl m-3 lg:my-4 lg:ms-4 h-[calc(100vh-2rem)] p-4 overflow-y-auto font-sans"
    >
      <div className="px-3 mb-4 text-xs font-extrabold text-slate-700 dark:text-slate-300 tracking-wider flex items-center justify-between border-b border-teal-200/60 dark:border-teal-800 pb-2.5">
        <span className="flex items-center gap-1.5 font-black text-slate-900 dark:text-slate-100">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-500 inline-block animate-pulse" />
          <span>بوابة الموظف (Lana HRMS)</span>
        </span>
      </div>

      <nav className="space-y-0.5 mb-5">
        <NavLink item={home} emphasized />
      </nav>

      {/* =========================================================================================
          إظهار جميع الصلاحيات في الخانات الجانبية (Administrative Capabilities Navigation)
          تظهر في الخانات الجانبية بوضوح تام لأي مسؤول أو إداري (مثل عبدالرحمن إبراهيم - الموارد البشرية)
          ========================================================================================= */}
      {isExecutiveOrManager ? (
        <div className="mb-6 space-y-2 bg-primary/5 p-3 rounded-2xl border border-primary/20">
          <p className="px-2 mb-1.5 text-[11px] font-black uppercase tracking-wider text-primary dark:text-primary/90 flex items-center gap-1.5">
            <span>👑 الصلاحيات والإدارة العليا</span>
          </p>
          <nav className="space-y-1">
            {[
              { href: "/dashboard", label: "لوحة التحكم التنفيذية", icon: LayoutDashboard },
              { href: "/employees", label: "إدارة الموظفين والعقود", icon: Users },
              { href: "/approvals", label: "مركز الموافقات والطلبات", icon: GitPullRequest },
              { href: "/attendance", label: "مراقبة الحضور والورديات", icon: Clock },
              { href: "/payroll", label: "مسير الرواتب والشؤون المالية", icon: DollarSign },
              { href: "/integrations/synchronization", label: "⚡ مزامنة أودو الشاملة (Odoo Sync)", icon: PlugZap },
              { href: "/permissions", label: "إدارة الصلاحيات والأدوار", icon: Shield },
              { href: "/reports", label: "التقارير والإعدادات العامة", icon: BarChart3 },
            ].map((admItem) => {
              const AdmIcon = admItem.icon;
              const active = isActive(admItem.href);
              return (
                <Link
                  key={admItem.href}
                  href={admItem.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 border",
                    active
                      ? "bg-primary text-white shadow font-black border-primary"
                      : "border-transparent text-slate-700 dark:text-slate-300 hover:bg-primary/15 hover:text-primary hover:border-primary/25"
                  )}
                >
                  <AdmIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{admItem.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      {/* =========================================================================================
          التصميم القديم المعتاد لباقي المجموعات (عملياتي، الطلبات، بياناتي، التواصل والإعدادات)
          ========================================================================================= */}
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="px-3 mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
            <nav className="space-y-0.5">
              {group.items.map((item) => <NavLink key={item.href} item={item} />)}
            </nav>
          </div>
        ))}
      </div>
    </div>
  );
}
