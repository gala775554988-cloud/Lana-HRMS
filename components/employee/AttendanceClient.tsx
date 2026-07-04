'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export function AttendanceClient({ employeeId, summary }: { employeeId: string; summary: any }) {
  const [status, setStatus] = useState(summary.todayStatus);
  const [loading, setLoading] = useState(false);

  const handleClock = async (action: 'checkin' | 'checkout') => {
    setLoading(true);
    try {
      await fetch('/api/hr/attendance', {
        method: 'POST',
        body: JSON.stringify({ employeeId, action }),
      });
      setStatus(action === 'checkin' ? 'present' : 'checked-out');
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-6xl font-mono tracking-tighter mb-2">
            {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-slate-500 mb-6">الوقت الحالي</div>

          <div className="flex justify-center gap-4">
            <Button 
              onClick={() => handleClock('checkin')} 
              disabled={loading || status === 'present'}
              className="px-8"
            >
              تسجيل دخول
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleClock('checkout')} 
              disabled={loading || status !== 'present'}
            >
              تسجيل خروج
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> ملخص اليوم
          </h3>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>الحالة</div><div className="font-medium">{status}</div>
            <div>ساعات اليوم</div><div className="font-medium">{summary.hoursToday.toFixed(1)} ساعة</div>
            <div>إجمالي الشهر</div><div className="font-medium">{summary.totalThisMonth} ساعة</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
