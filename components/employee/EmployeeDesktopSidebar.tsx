'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';

export function EmployeeDesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { home, groups } = useEmployeeNavItems();

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
            ? 'bg-indigo-600 text-white shadow'
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
    <div className="p-4">
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
              {group.items.map((item) => <NavLink key={item.href} item={item} />)}
            </nav>
          </div>
        ))}
      </div>
    </div>
  );
}
