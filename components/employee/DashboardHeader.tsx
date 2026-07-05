'use client';

import React from 'react';
import { Clock, Calendar } from 'lucide-react';
import type { EmployeeProfile } from '@/types/employee';

interface Props {
  employee: EmployeeProfile;
  attendanceStatus?: string;
}

export function DashboardHeader({ employee, attendanceStatus = 'present' }: Props) {
  if (!employee) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        جاري تحميل بيانات الموظف...
      </div>
    );
  }

  const firstName = employee.firstName || '';
  const lastName = employee.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'موظف';
  const now = new Date();
  const time = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const statusLabel = 
    attendanceStatus === 'present' ? 'حاضر' :
    attendanceStatus === 'checked-out' ? 'مغادر' : 'غير مسجل';

  const statusColor = 
    attendanceStatus === 'present' ? 'text-emerald-600 bg-emerald-50' :
    attendanceStatus === 'checked-out' ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100';

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex items-center gap-4">
        {employee.profilePhotoUrl ? (
          <img 
            src={employee.profilePhotoUrl} 
            alt={fullName} 
            className="h-14 w-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" 
          />
        ) : (
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-semibold border border-white/20 shadow-sm">
            {(employee.firstName?.[0] || '?')}{(employee.lastName?.[0] || '?')}
          </div>
        )}

        <div>
          <div className="text-sm text-slate-500">مرحباً</div>
          <div className="text-2xl font-semibold tracking-tight">{fullName}</div>
          <div className="text-sm text-slate-600 mt-0.5">
            {employee.position?.title || 'موظف'} • {employee.department?.name || 'غير محدد'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Current Time */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <Clock className="h-4 w-4 text-indigo-600" />
          <div className="text-sm font-medium tabular-nums">{time}</div>
        </div>

        {/* Today's Attendance Status */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm ${statusColor}`}>
          <Calendar className="h-4 w-4" />
          <div className="text-sm font-medium">اليوم: {statusLabel}</div>
        </div>
      </div>
    </div>
  );
}
