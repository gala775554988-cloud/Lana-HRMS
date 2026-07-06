'use client';

import React, { useState } from 'react';
import { Search, Bell, Globe, Sun, Moon, User } from 'lucide-react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/brand-logo';

interface Props {
  user: any;
  employee?: any;
}

export function EmployeeHeader({ user, employee }: Props) {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="h-[72px] sticky top-0 z-50 border-b bg-white dark:bg-slate-900">
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <BrandLogo
          href="/employee/dashboard"
          size="sm"
          subtitle="Employee Portal"
          subtitleClassName="text-slate-500 dark:text-slate-400"
        />

        {/* Search */}
        <div className="hidden md:block flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث في النظام..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-[#E5E7EB] rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-slate-300"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-red-500 rounded-full" />
          </button>

          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <Globe className="h-4 w-4" />
          </button>

          <Link href="/employee/profile" className="flex items-center gap-2 ml-2 pl-3 border-l border-[#E5E7EB]">
            <div className="hidden md:block text-right text-xs leading-tight">
              <div className="font-medium">{user?.name || employee?.firstName}</div>
              <div className="text-slate-500 text-[10px]">{employee?.employeeNumber}</div>
            </div>
            {employee?.profilePhotoUrl ? (
              <img src={employee.profilePhotoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-[#E5E7EB]" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-500" />
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
