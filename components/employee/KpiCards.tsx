'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, FileText, DollarSign } from 'lucide-react';

interface Props {
  attendance: any;
  leaveBalance: any;
  payroll: any;
  requests: any;
}

export function KpiCards({ attendance, leaveBalance, payroll, requests }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Clock className="h-4 w-4" /> الحضور اليوم
          </div>
          <div className="text-3xl font-semibold tracking-tight">{attendance.hoursToday.toFixed(1)}h</div>
          <div className="text-xs text-emerald-600 mt-1">{attendance.todayStatus}</div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Calendar className="h-4 w-4" /> رصيد الإجازات
          </div>
          <div className="text-3xl font-semibold tracking-tight">{leaveBalance.annual.remaining}</div>
          <div className="text-xs text-slate-500 mt-1">يوم من {leaveBalance.annual.total}</div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <FileText className="h-4 w-4" /> الطلبات المعلقة
          </div>
          <div className="text-3xl font-semibold tracking-tight">{requests.pending}</div>
          <div className="text-xs text-slate-500 mt-1">{requests.approved} معتمدة</div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <DollarSign className="h-4 w-4" /> الراتب
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {payroll.baseSalary.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">{payroll.currency}</div>
        </CardContent>
      </Card>
    </div>
  );
}
