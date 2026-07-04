'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, Calendar, DollarSign, FileText, 
  CheckSquare, Bell 
} from 'lucide-react';
import Link from 'next/link';

interface Props {
  attendance: any;
  leaveBalance: any;
  payroll: any;
  requests: any;
  tasks: any[];
  notifications: any[];
  employeeId: string;
}

export function DashboardWidgets({ attendance, leaveBalance, payroll, requests, tasks, notifications, employeeId }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      
      {/* Today's Attendance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-violet-600" /> الحضور اليوم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold mb-1">
            {attendance.hoursToday.toFixed(1)} ساعات
          </div>
          <div className="text-sm text-muted-foreground">
            {attendance.checkIn ? `دخول: ${attendance.checkIn}` : 'لم تسجل دخول بعد'}
          </div>
          <Link href="/employee/attendance" className="text-xs text-violet-600 mt-2 inline-block">عرض سجل الحضور →</Link>
        </CardContent>
      </Card>

      {/* Leave Balance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-emerald-600" /> رصيد الإجازات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>سنوية</span>
            <span className="font-medium">{leaveBalance.annual.remaining} / {leaveBalance.annual.total} يوم</span>
          </div>
          <div className="flex justify-between">
            <span>مرضية</span>
            <span className="font-medium">{leaveBalance.sick.remaining} / {leaveBalance.sick.total} يوم</span>
          </div>
          <Link href="/employee/leave" className="text-xs text-emerald-600">إدارة الإجازات →</Link>
        </CardContent>
      </Card>

      {/* Salary Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-emerald-600" /> ملخص الراتب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold mb-1">
            {payroll.baseSalary.toLocaleString()} <span className="text-sm font-normal">{payroll.currency}</span>
          </div>
          <div className="text-sm">الراتب الأساسي</div>
          <Link href="/employee/salary" className="text-xs text-emerald-600 mt-2 inline-block">عرض كشف الرواتب →</Link>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> الطلبات المعلقة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{requests.pending}</div>
          <div className="flex gap-2 mt-3">
            <Badge variant="outline">{requests.approved} معتمد</Badge>
            <Badge variant="outline">{requests.rejected} مرفوض</Badge>
          </div>
          <Link href="/employee/requests" className="text-xs text-violet-600 mt-2 inline-block">جميع الطلبات →</Link>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4" /> المهام القادمة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد مهام حالياً</div>
          ) : (
            <div className="space-y-2 text-sm">
              {tasks.slice(0, 3).map((task: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.dueDate}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/employee/tasks" className="text-xs text-violet-600 mt-2 inline-block">عرض المهام كاملة →</Link>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> آخر الإشعارات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {notifications.length === 0 && <div className="text-muted-foreground">لا توجد إشعارات</div>}
          {notifications.slice(0, 3).map((n: any, i: number) => (
            <div key={i} className="border-l-2 border-violet-500 pl-3">
              <div className="font-medium text-sm">{n.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</div>
            </div>
          ))}
          <Link href="/employee/notifications" className="text-xs text-violet-600">جميع الإشعارات →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
