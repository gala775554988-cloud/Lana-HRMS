'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function SalaryView({ payroll }: { payroll: any }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>الراتب الحالي</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight">
            {payroll?.baseSalary?.toLocaleString() || '—'} <span className="text-xl">ريال</span>
          </div>
          <div className="text-sm text-slate-500 mt-1">{payroll?.currency}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">سجل الرواتب</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm">آخر دفعة: {payroll?.lastPayDate || 'غير متوفر'}</div>
            <Button asChild variant="outline" className="mt-4"><Link href="/api/employee/payslip">تحميل كشف الراتب (PDF)</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
