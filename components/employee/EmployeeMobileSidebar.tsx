'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Briefcase, FolderOpen, FileText, CalendarClock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';

const PROFILE_SUB_ITEMS: EmployeeNavItem[] = [
  { href: '/employee/profile', label: 'البيانات الوظيفية', icon: Briefcase },
  { href: '/employee/documents', label: 'الوثائق', icon: FolderOpen },
  { href: '/employee/documents?category=contracts', label: 'العقود', icon: FileText },
  { href: '/employee/leave/history', label: 'سجل الإجازات', icon: CalendarClock },
];

export function EmployeeMobileSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { home, groups } = useEmployeeNavItems();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'profile'>('main');

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

  // Close whenever the route actually changes (link click already closes it too,
  // but this covers back/forward navigation and programmatic redirects).
  useEffect(() => { setOpen(false); setView('main'); }, [pathname]);

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
          'flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[11px] font-medium transition-colors',
          active
            ? 'bg-primary text-white shadow'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        )}
      >
        <span className="relative inline-flex shrink-0">
          <Icon className="h-5 w-5" />
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
        <span className="leading-tight">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="lg:hidden">
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
          className="fixed inset-0 z-[70] flex items-end bg-black/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <nav
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full overflow-y-auto overflow-x-hidden rounded-t-[2rem] bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl animate-scale-in dark:bg-slate-900"
          >
            <AnimatePresence mode="wait" initial={false}>
              {view === 'main' ? (
                <motion.div
                  key="main-menu"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="mb-3 flex items-center justify-between px-2">
                    <span className="text-xs font-semibold tracking-wider text-slate-500">بوابة الموظف</span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="إغلاق"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <NavTile item={home} />
                  </div>

                  <div className="space-y-4">
                    {groups.map((group) => (
                      <div key={group.key}>
                        <p className="px-1 mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {group.items
                            .filter((item) => item.href !== '/employee/profile')
                            .map((item) => <NavTile key={item.href} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setView('profile')}
                    className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm font-bold text-primary dark:border-primary/25 dark:bg-primary/10"
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
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="mb-3 flex items-center justify-between px-2">
                    <button
                      type="button"
                      onClick={() => setView('main')}
                      className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      <span>رجوع</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="إغلاق"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 px-2 mb-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary text-white">
                      <User className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">ملفي</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {PROFILE_SUB_ITEMS.map((item) => <NavTile key={item.href} item={item} />)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
