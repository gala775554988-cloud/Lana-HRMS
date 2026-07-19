'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Briefcase, FolderOpen, FileText, CalendarClock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';

const PROFILE_SUB_ITEMS: EmployeeNavItem[] = [
  { href: '/employee/profile', label: 'البيانات الوظيفية', icon: Briefcase },
  { href: '/employee/documents', label: 'الوثائق', icon: FolderOpen },
  { href: '/employee/documents?category=contracts', label: 'العقود', icon: FileText },
  { href: '/employee/leave/history', label: 'سجل الإجازات', icon: CalendarClock },
];

export function EmployeeDesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { home, groups } = useEmployeeNavItems();
  const [view, setView] = useState<'main' | 'profile'>('main');

  const handleIntent = (href: string) => router.prefetch(href);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

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
          'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 will-change-transform hover:-translate-y-0.5 active:scale-[0.985]',
          active
            ? 'bg-primary text-white shadow'
            : emphasized
            ? 'text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:bg-slate-900/60 dark:hover:bg-slate-800'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
        )}
      >
        <span className="relative inline-flex shrink-0">
          <Icon className="h-4 w-4" />
          {item.badge ? (
            <span
              key={item.badge}
              className="absolute -top-1.5 -end-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-white dark:ring-slate-900"
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
    <div className="p-4 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'main' ? (
          <motion.div
            key="main-menu"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-3 mb-4 text-xs font-semibold text-slate-500 tracking-wider">بوابة الموظف</div>

            <nav className="space-y-0.5 mb-4">
              <NavLink item={home} emphasized />
            </nav>

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="px-3 mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                  <nav className="space-y-0.5">
                    {group.items
                      .filter((item) => item.href !== '/employee/profile')
                      .map((item) => <NavLink key={item.href} item={item} />)}
                  </nav>
                </div>
              ))}
            </div>

            {/* Pinned "ملفي" launcher: swaps the whole sidebar to ProfileMenu
                in place instead of navigating, per the Smart Navigation brief. */}
            <button
              type="button"
              onClick={() => setView('profile')}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/10 dark:border-primary/25 dark:bg-primary/10"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary text-white">
                <User className="h-4 w-4" />
              </span>
              <span>ملفي</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="profile-menu"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => setView('main')}
              className="flex items-center gap-2 px-3 mb-3 text-xs font-bold text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              <span>رجوع للقائمة الرئيسية</span>
            </button>

            <div className="flex items-center gap-3 px-3 mb-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary text-white">
                <User className="h-4.5 w-4.5" />
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">ملفي</p>
            </div>

            <nav className="space-y-0.5">
              {PROFILE_SUB_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
