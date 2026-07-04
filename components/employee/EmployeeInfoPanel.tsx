'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Clock, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { EmployeeProfile } from '@/types/employee';

interface Props {
  employee?: EmployeeProfile | null;
}

export function EmployeeInfoPanel({ employee }: Props) {
  if (!employee) {
    return <div className="p-6 text-sm">لا توجد بيانات موظف</div>;
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-slate-900 border-l border-[#E5E7EB] h-full">
      <div className="text-center">
        {employee.profilePhotoUrl ? (
          <img 
            src={employee.profilePhotoUrl} 
            alt={fullName} 
            className="h-20 w-20 mx-auto rounded-2xl object-cover border border-[#E5E7EB]" 
          />
        ) : (
          <div className="h-20 w-20 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 text-3xl font-semibold border border-[#E5E7EB]">
            {employee.firstName[0]}{employee.lastName[0]}
          </div>
        )}
        <div className="mt-4">
          <div className="font-semibold text-lg">{fullName}</div>
          <div className="text-sm text-slate-500">{employee.position?.title}</div>
          <Badge variant="outline" className="mt-1.5">#{employee.employeeNumber}</Badge>
        </div>
      </div>

      <div className="space-y-3 text-sm border-t pt-4">
        <div className="flex justify-between"><span className="text-slate-500">القسم</span><span className="font-medium">{employee.department?.name || '—'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">الإدارة</span><span className="font-medium">{employee.department?.name || '—'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">رقم الموظف</span><span className="font-medium">{employee.employeeNumber}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">الهوية</span><span className="font-medium">{employee.nationalId}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">الجوال</span><span className="font-medium">{employee.phone || '—'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">البريد</span><span className="font-medium text-xs truncate">{employee.email || '—'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">تاريخ التعيين</span><span className="font-medium">{new Date(employee.hireDate).toLocaleDateString('ar-SA')}</span></div>
        <div className="flex justify-between items-center"><span className="text-slate-500">الحالة</span><Badge className="bg-emerald-100 text-emerald-700">{employee.status}</Badge></div>
      </div>

      <div className="space-y-3 pt-3 border-t">
        <div className="text-xs font-semibold text-slate-500 mb-1">الأرصدة</div>
        <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-slate-400" /> رصيد الإجازات <span className="font-semibold ml-auto">22 يوم</span></div>
        <div className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-slate-400" /> رصيد السلف <span className="font-semibold ml-auto">١٥٠٠ ريال</span></div>
        <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-slate-400" /> ساعات العمل <span className="font-semibold ml-auto">١٦٠ ساعة</span></div>
      </div>

      <Link href="/employee/profile">
        <Button variant="outline" className="w-full gap-2 border-[#E5E7EB] text-sm">
          <Edit2 className="h-3.5 w-3.5" /> تعديل الملف الشخصي
        </Button>
      </Link>
    </div>
  );
}
