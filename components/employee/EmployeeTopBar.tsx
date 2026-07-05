'use client';

import React, { useState } from 'react';
import { Search, Bell, Globe, Sun, Moon, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface Props {
  user: any;
  employee?: any;
}

export function EmployeeTopBar({ user, employee }: Props) {
  const { data: session } = useSession();
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Safe access to prevent crashes
  const sessionUser = session?.user as any;
  const avatarUrl = sessionUser?.image || employee?.profilePhotoUrl || null;

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-semibold text-lg shadow-sm">
            L
          </div>
          <div className="hidden sm:block">
            <div className="font-semibold tracking-tight text-lg">Lana HRMS</div>
            <div className="text-[10px] text-slate-500 -mt-1">Employee Portal</div>
          </div>
        </div>

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن طلبات أو وثائق..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-700"
            />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </button>

          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <Globe className="h-4 w-4" />
          </button>

          <Link href="/employee/profile" className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 dark:border-slate-700">
            <div className="hidden sm:block text-right text-xs leading-tight">
              <div className="font-medium truncate max-w-[110px]">
                {user?.name || (employee as any)?.firstName || 'موظف'}
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
