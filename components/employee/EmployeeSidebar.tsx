'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Clock, Calendar, FileText, DollarSign, 
  CheckSquare, Bell, User, Folder, Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/employee/dashboard', label: 'الرئيسية', icon: Home },
  { href: '/employee/attendance', label: 'الحضور والانصراف', icon: Clock },
  { href: '/employee/leave', label: 'الإجازات', icon: Calendar },
  { href: '/employee/requests', label: 'الطلبات', icon: FileText },
  { href: '/employee/salary', label: 'الرواتب', icon: DollarSign },
  { href: '/employee/tasks', label: 'المهام', icon: CheckSquare },
  { href: '/employee/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/employee/profile', label: 'الملف الشخصي', icon: User },
  { href: '/employee/documents', label: 'المستندات', icon: Folder },
  { href: '/employee/settings', label: 'الإعدادات', icon: Settings },
];

export function EmployeeSidebar({ currentEmployeeId }: { currentEmployeeId?: string }) {
  const pathname = usePathname();

  return (
    <div className="h-full pt-4 pb-8 px-4 border-l border-[#E5E7EB]">
      <div className="px-3 mb-3 text-xs uppercase tracking-wider text-slate-500 font-medium">القائمة الرئيسية</div>
      
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/employee/dashboard' && pathname === '/employee/dashboard');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                isActive 
                  ? "bg-slate-100 text-slate-900 font-medium dark:bg-slate-800" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
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
