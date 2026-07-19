'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';

export function EmployeeMobileSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { home, groups } = useEmployeeNavItems();
  const [open, setOpen] = useState(false);

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
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl animate-scale-in dark:bg-slate-900"
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
