'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle } from 'lucide-react';

export function AttendancePage({ employee, summary }: any) {
  const [isCheckedIn, setIsCheckedIn] = useState(summary.todayStatus !== 'absent');

  const handleCheck = async () => {
    // In production this would call a real API
    const res = await fetch('/api/hr/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id, action: isCheckedIn ? 'checkout' : 'checkin' }),
    });
    if (res.ok) {
      setIsCheckedIn(!isCheckedIn);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">الحضور والانصراف</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>تسجيل الحضور اليوم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="text-5xl font-mono font-semibold">{new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-sm text-muted-foreground mt-1">الوقت الحالي</div>
          </div>

          <Button onClick={handleCheck} className="w-full h-12" size="lg">
            {isCheckedIn ? 'تسجيل خروج' : 'تسجيل دخول'}
          </Button>

          <div className="text-xs text-center text-muted-foreground">
            {summary.checkIn ? `دخول: ${summary.checkIn}` : 'لم يتم تسجيل دخول'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ملخص هذا الشهر</CardTitle></CardHeader>
        <CardContent>
          <div>إجمالي ساعات العمل: <span className="font-semibold">{summary.totalThisMonth}</span> ساعة</div>
        </CardContent>
      </Card>
    </div>
  );
}
