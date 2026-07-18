'use client';

import React, { useState } from 'react';
import { Search, Sun, Moon, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { ClientLanguageToggle } from '@/components/i18n/client-language-toggle';
import { NotificationBell } from '@/components/enterprise/notification-bell';
import { PortalMenu } from '@/components/portal-menu';

interface Props {
  user: any;
  employee?: any;
}

export function EmployeeTopBar({ user, employee }: Props) {
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const avatarUrl = user?.image || employee?.profilePhotoUrl || null;

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
  };

  const handleLogout = async () => {
    await signOut({ 
      redirect: true, 
      callbackUrl: "/login" 
    });
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Logo */}
        <BrandLogo
          href="/employee/dashboard"
          size="sm"
          subtitle="Employee Portal"
          className="gap-3"
          logoClassName="h-12 w-12"
          textClassName="hidden sm:block"
          subtitleClassName="text-slate-500 dark:text-slate-400"
        />

        <PortalMenu className="hidden lg:flex mx-2" />

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن طلبات أو وثائق..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/30 dark:focus:border-primary"
            />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />

          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <ClientLanguageToggle variant="ghost" icon="globe" className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" />

          <Link href="/employee/profile" className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 dark:border-slate-700">
            <div className="hidden sm:block text-right text-xs leading-tight">
              <div className="font-medium truncate max-w-[130px] flex items-center">
                <span className="truncate">{user?.name || (employee as any)?.firstName || 'موظف'}</span>
                {Boolean((employee as any)?.isDelegate || (user as any)?.roles?.some((r: any) => ["SUPER_ADMIN", "HR_MANAGER"].includes(typeof r === "string" ? r : r?.name))) && (
                  <span className="text-yellow-500 text-sm ms-1 shrink-0" title="مفوض تنفيذي">👑</span>
                )}
              </div>
              <div className="text-slate-500 text-[10px]">
                {(employee as any)?.employeeNumber || '---'}
              </div>
            </div>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-500" />
              </div>
            )}
          </Link>

          <button onClick={handleLogout} className="ml-1 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950 text-red-600 transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
