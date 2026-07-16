'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { EMPLOYEE_NAV_ITEMS } from '@/lib/employee/nav-items';

export function EmployeeDesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleIntent = (href: string) => router.prefetch(href);

  return (
    <div className="p-4">
      <div className="px-3 mb-4 text-xs font-semibold text-slate-500 tracking-wider">بوابة الموظف</div>
      <nav className="space-y-0.5">
        {EMPLOYEE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              prefetch={true}
              onMouseEnter={() => handleIntent(item.href)}
              onFocus={() => handleIntent(item.href)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 will-change-transform hover:-translate-y-0.5 active:scale-[0.985]',
                active 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
