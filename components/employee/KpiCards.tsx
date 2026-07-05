'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, FileText, DollarSign } from 'lucide-react';
import type { AttendanceSummary, LeaveBalance, PayrollSummary, RequestSummary } from '@/types/employee';

interface Props {
  attendance: AttendanceSummary;
  leaveBalance: LeaveBalance;
  payroll: PayrollSummary;
  requests: RequestSummary;
}

export function KpiCards({ attendance, leaveBalance, payroll, requests }: Props) {
  const safeAttendance = attendance || { todayStatus: 'absent', hoursToday: 0 };
  const safeLeave = leaveBalance || { annual: { remaining: 30, total: 30 } };
  const safePayroll = payroll || { baseSalary: 0, currency: 'SAR' };
  const safeRequests = requests || { pending: 0, approved: 0 };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Clock className="h-4 w-4" /> الحضور اليوم
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {(safeAttendance.hoursToday || 0).toFixed(1)}h
          </div>
          <div className="text-xs text-emerald-600 mt-1">{safeAttendance.todayStatus || 'absent'}</div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Calendar className="h-4 w-4" /> رصيد الإجازات
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {safeLeave.annual?.remaining ?? 30}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            يوم من {safeLeave.annual?.total ?? 30}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <FileText className="h-4 w-4" /> الطلبات المعلقة
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {safeRequests.pending ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {safeRequests.approved ?? 0} معتمدة
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <DollarSign className="h-4 w-4" /> الراتب
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {(safePayroll.baseSalary || 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {safePayroll.currency || 'SAR'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
