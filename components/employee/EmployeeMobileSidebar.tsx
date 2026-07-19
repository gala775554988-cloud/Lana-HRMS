'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Menu, X, LayoutDashboard, Users, GitPullRequest, DollarSign,
  Shield, PlugZap, BarChart3, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';

export function EmployeeMobileSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { home, groups } = useEmployeeNavItems();
  const [open, setOpen] = useState(false);

  const userRoles = (session?.user?.roles as string[]) || [];
  const isExecutiveOrManager = userRoles.some((r) =>
    ["SUPER_ADMIN", "HR_MANAGER", "DIRECT_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "PAYROLL_OFFICER", "ADMIN"].includes(r) ||
    r.includes("HR") || r.includes("ADMIN") || r.includes("MANAGER")
  );

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const handleIntent = (href: string) => router.prefetch(href);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const NavTile = ({ item }: { item: EmployeeNavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        prefetch={true}
        onMouseEnter={() => handleIntent(item.href)}
        onFocus={() => handleIntent(item.href)}
        onTouchStart={() => handleIntent(item.href)}
        onClick={() => setOpen(false)}
        className={cn(
          'flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[11px] font-bold transition-colors border',
          active
            ? 'bg-primary text-white shadow font-black border-primary'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:border-primary/40'
        )}
      >
        <span className="relative inline-flex shrink-0">
          <Icon className="h-5 w-5" />
          {item.badge ? (
            <span
              key={item.badge}
              className="absolute -top-1.5 -end-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-white dark:ring-slate-900"
            >
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </span>
        <span className="leading-tight truncate w-full">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="lg:hidden font-sans">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح قائمة التنقل"
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[60] grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 transition-transform active:scale-95"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <nav
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full flex flex-col overflow-hidden rounded-t-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl transition-all p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" />
                <span>بوابة الموظف (Lana HRMS)</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-5">
              <NavTile item={home} />
            </div>

            {/* =========================================================================================
                إظهار جميع الصلاحيات في الخانات الجانبية للجوال (Administrative Capabilities Navigation)
                ========================================================================================= */}
            {isExecutiveOrManager ? (
              <div className="mb-6 space-y-2 bg-primary/5 p-3 rounded-2xl border border-primary/20">
                <p className="px-1 mb-2 text-[11px] font-black uppercase tracking-wider text-primary dark:text-primary/90">
                  👑 الصلاحيات والإدارة العليا
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
                    { href: "/employees", label: "إدارة الموظفين", icon: Users },
                    { href: "/approvals", label: "مركز الموافقات", icon: GitPullRequest },
                    { href: "/attendance", label: "الحضور والورديات", icon: Clock },
                    { href: "/payroll", label: "مسير الرواتب", icon: DollarSign },
                    { href: "/integrations/synchronization", label: "⚡ مزامنة أودو", icon: PlugZap },
                    { href: "/permissions", label: "إدارة الصلاحيات", icon: Shield },
                    { href: "/reports", label: "التقارير", icon: BarChart3 },
                  ].map((admItem) => {
                    const AdmIcon = admItem.icon;
                    const active = isActive(admItem.href);
                    return (
                      <Link
                        key={admItem.href}
                        href={admItem.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-extrabold border transition-colors",
                          active
                            ? "bg-primary text-white shadow font-black border-primary"
                            : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-primary/40"
                        )}
                      >
                        <AdmIcon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{admItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* التصميم القديم المعتاد لكافة المجموعات */}
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {group.items.map((item) => <NavTile key={item.href} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
