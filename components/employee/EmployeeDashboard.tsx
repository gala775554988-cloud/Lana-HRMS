'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Calendar, Clock, FileText, CheckSquare } from 'lucide-react';
import type { EmployeeProfile } from '@/types/employee';

interface Props {
  employee: EmployeeProfile;
  attendance: any;
  leaveBalance: any;
  payroll: any;
  requestsSummary: any;
  tasks: any[];
  notifications: any[];
}

export function EmployeeDashboard({ 
  employee, 
  attendance, 
  leaveBalance, 
  payroll, 
  requestsSummary, 
  tasks, 
  notifications 
}: Props) {
  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <div className="space-y-8">
      {/* Clean white welcome header */}
      <div className="flex items-center gap-4 pb-2">
        {employee.profilePhotoUrl ? (
          <img src={employee.profilePhotoUrl} className="h-12 w-12 rounded-xl object-cover border" alt="" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-slate-200 flex items-center justify-center text-xl font-medium border">
            {employee.firstName[0]}{employee.lastName[0]}
          </div>
        )}
        <div>
          <div className="text-sm text-slate-500">مرحباً</div>
          <div className="text-2xl font-semibold tracking-tight">{fullName}</div>
          <div className="text-sm text-slate-600">{employee.position?.title} • {employee.department?.name}</div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="text-sm text-slate-500 flex items-center gap-2"><Calendar className="h-4 w-4" /> رصيد الإجازات</div>
            <div className="text-3xl font-semibold mt-1">{leaveBalance.annual.remaining}</div>
            <div className="text-xs text-slate-400">من {leaveBalance.annual.total} يوم</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="text-sm text-slate-500 flex items-center gap-2"><Clock className="h-4 w-4" /> ساعات العمل</div>
            <div className="text-3xl font-semibold mt-1">{attendance.totalThisMonth}</div>
            <div className="text-xs text-slate-400">هذا الشهر</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="text-sm text-slate-500 flex items-center gap-2"><FileText className="h-4 w-4" /> الطلبات</div>
            <div className="text-3xl font-semibold mt-1">{requestsSummary.pending}</div>
            <div className="text-xs text-slate-400">{requestsSummary.approved} معتمدة</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="text-sm text-slate-500 flex items-center gap-2"><CheckSquare className="h-4 w-4" /> المهام</div>
            <div className="text-3xl font-semibold mt-1">{tasks.length}</div>
            <div className="text-xs text-slate-400">قيد التنفيذ</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - 4 columns enterprise style */}
      <div>
        <div className="mb-3 text-sm font-semibold text-slate-700">إجراءات سريعة</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "طلب إجازة", href: "/employee/leave", desc: "تقديم طلب إجازة" },
            { label: "طلب سلفة", href: "/employee/requests", desc: "طلب سلفة مالية" },
            { label: "تسجيل حضور", href: "/employee/attendance", desc: "الحضور والانصراف" },
            { label: "ساعات إضافية", href: "/employee/requests", desc: "طلب overtime" },
          ].map((item, idx) => (
            <Link key={idx} href={item.href}>
              <Card className="border-[#E5E7EB] hover:shadow-sm transition bg-white">
                <CardContent className="p-4">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Requests Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">الطلبات الأخيرة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-xs">
                  <th className="py-2 text-right font-medium">النوع</th>
                  <th className="py-2 text-right font-medium">التاريخ</th>
                  <th className="py-2 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {requestsSummary.pending > 0 ? (
                  <tr className="border-b">
                    <td className="py-3">طلب إجازة</td>
                    <td className="py-3 text-slate-500">اليوم</td>
                    <td className="py-3"><Badge variant="outline">قيد المراجعة</Badge></td>
                  </tr>
                ) : (
                  <tr><td colSpan={3} className="text-center py-4 text-slate-400">لا توجد طلبات حديثة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Timeline */}
      <Card className="border-[#E5E7EB]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">الإشعارات الأخيرة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {notifications.length > 0 ? notifications.slice(0, 5).map((n, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
              <div>
                {n.title}
                <div className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</div>
              </div>
            </div>
          )) : <div className="text-slate-400">لا توجد إشعارات جديدة.</div>}
          <Link href="/employee/notifications" className="text-xs text-slate-600">عرض كل الإشعارات →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
