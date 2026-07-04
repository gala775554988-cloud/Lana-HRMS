'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EmployeeProfile } from '@/types/employee';

export function EmployeeProfileForm({ employee }: { employee: EmployeeProfile | null }) {
  if (!employee) return <div>لا توجد بيانات</div>;

  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <div className="max-w-2xl space-y-8">
      <Card>
        <CardHeader><CardTitle>المعلومات الأساسية</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الاسم الأول</Label>
              <Input value={employee.firstName} readOnly />
            </div>
            <div>
              <Label>الاسم الأخير</Label>
              <Input value={employee.lastName} readOnly />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>رقم الموظف</Label><Input value={employee.employeeNumber} readOnly /></div>
            <div><Label>الهوية الوطنية</Label><Input value={employee.nationalId} readOnly /></div>
          </div>
          <div><Label>البريد الإلكتروني</Label><Input value={employee.email || ''} readOnly /></div>
          <div><Label>رقم الهاتف</Label><Input value={employee.phone || ''} readOnly /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الوظيفة والقسم</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between"><span>المسمى الوظيفي</span><span>{employee.position?.title || '—'}</span></div>
          <div className="flex justify-between"><span>القسم</span><span>{employee.department?.name || '—'}</span></div>
          <div className="flex justify-between"><span>تاريخ التعيين</span><span>{new Date(employee.hireDate).toLocaleDateString('ar-SA')}</span></div>
          <div className="flex justify-between"><span>الحالة</span><span className="font-medium text-emerald-600">{employee.status}</span></div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">يمكنك تعديل بيانات الاتصال من خلال قسم الموارد البشرية.</div>
    </div>
  );
}
