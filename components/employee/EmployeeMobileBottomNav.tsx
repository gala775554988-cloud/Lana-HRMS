'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Clock, Calendar, DollarSign, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/employee/dashboard', label: 'الرئيسية', icon: Home },
  { href: '/employee/attendance', label: 'الحضور', icon: Clock },
  { href: '/employee/leave', label: 'الإجازات', icon: Calendar },
  { href: '/employee/salary', label: 'الرواتب', icon: DollarSign },
  { href: '/employee/profile', label: 'المزيد', icon: Menu },
];

export function EmployeeMobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden border-t bg-white dark:bg-slate-900 px-2 py-1.5 grid grid-cols-5 text-xs">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link key={item.href} href={item.href} prefetch={false} className={cn('flex flex-col items-center justify-center py-1 rounded-xl transition', active ? 'text-indigo-600' : 'text-slate-500')}>
            <Icon className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
