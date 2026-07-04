'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SalaryPage({ employee, payroll }: any) {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">الرواتب</h1>

      <Card>
        <CardHeader><CardTitle>الراتب الحالي</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-5xl font-semibold tracking-tighter">
            {payroll.baseSalary.toLocaleString()} <span className="text-xl font-normal">{payroll.currency}</span>
          </div>
          <div className="text-sm text-muted-foreground">الراتب الأساسي</div>
        </CardContent>
      </Card>

      <div className="text-sm">تفاصيل الرواتب السابقة متاحة من خلال قسم الموارد البشرية.</div>
    </div>
  );
}
