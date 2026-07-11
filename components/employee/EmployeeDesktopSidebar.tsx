'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Clock, Calendar, FileText, DollarSign, Bell, User, FolderOpen, Settings, ShieldCheck, CheckSquare, Package, Award, GraduationCap, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/employee/dashboard', label: 'الرئيسية', icon: Home },
  { href: '/employee/profile', label: 'ملفي الشخصي', icon: User },
  { href: '/employee/attendance', label: 'الحضور والانصراف', icon: Clock },
  { href: '/employee/leave', label: 'الإجازات', icon: Calendar },
  { href: '/employee/permissions', label: 'الاستئذانات', icon: ShieldCheck },
  { href: '/employee/tasks', label: 'المهام', icon: CheckSquare },
  { href: '/employee/salary', label: 'الرواتب', icon: DollarSign },
  { href: '/employee/assets', label: 'العهد', icon: Package },
  { href: '/employee/documents', label: 'المستندات', icon: FolderOpen },
  { href: '/employee/performance', label: 'التقييم', icon: Award },
  { href: '/employee/training', label: 'التدريب', icon: GraduationCap },
  { href: '/employee/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/employee/chat', label: 'المحادثات', icon: MessageCircle },
  { href: '/employee/settings', label: 'الإعدادات', icon: Settings },
];

export function EmployeeDesktopSidebar() {
  const pathname = usePathname();
  return (
    <div className="p-4">
      <div className="px-3 mb-4 text-xs font-semibold text-slate-500 tracking-wider">بوابة الموظف</div>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all', active ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800')}>
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
