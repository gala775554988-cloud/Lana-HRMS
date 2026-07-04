'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function LeavePage({ employee, balance }: any) {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">الإجازات</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>رصيد الإجازات السنوية</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{balance.annual.remaining} <span className="text-base">يوم</span></div>
            <div className="text-sm mt-1">من أصل {balance.annual.total} يوم</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>رصيد الإجازات المرضية</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{balance.sick.remaining} <span className="text-base">يوم</span></div>
            <div className="text-sm mt-1">من أصل {balance.sick.total} يوم</div>
          </CardContent>
        </Card>
      </div>

      <Link href="/employee/requests">
        <Button size="lg" className="bg-violet-600">تقديم طلب إجازة جديد</Button>
      </Link>
    </div>
  );
}
