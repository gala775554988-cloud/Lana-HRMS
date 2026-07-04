'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import type { EmployeeProfile } from '@/types/employee';

interface Props {
  employee: EmployeeProfile;
}

export function DashboardHeader({ employee }: Props) {
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const now = new Date();
  const time = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {employee.profilePhotoUrl ? (
          <img 
            src={employee.profilePhotoUrl} 
            alt={fullName} 
            className="h-12 w-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700" 
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl font-semibold border">
            {employee.firstName[0]}{employee.lastName[0]}
          </div>
        )}
        <div>
          <div className="text-sm text-slate-500">مرحباً</div>
          <div className="text-2xl font-semibold tracking-tight">{fullName}</div>
          <div className="text-sm text-slate-600">{employee.position?.title} • {employee.department?.name}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-right">
        <div className="hidden sm:block text-sm text-slate-500">{date}</div>
        <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-indigo-600" />
          <span className="font-mono font-medium">{time}</span>
        </div>
      </div>
    </div>
  );
}
