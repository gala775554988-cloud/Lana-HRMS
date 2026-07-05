'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  createdAt: string;
}

interface Props {
  notifications?: Notification[];
}

export function LatestNotifications({ notifications = [] }: Props) {
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  return (
    <Card className="border-slate-200 dark:border-slate-800 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">آخر الإشعارات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {safeNotifications.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد إشعارات جديدة</p>
        ) : (
          safeNotifications.slice(0, 4).map((n, i) => {
            const date = n.createdAt ? new Date(n.createdAt) : new Date();
            return (
              <div key={n.id || i} className="text-sm">
                <div className="font-medium">{n.title || "إشعار"}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {date.toLocaleDateString('ar-SA')}
                </div>
              </div>
            );
          })
        )}
        <Link href="/employee/notifications" className="text-xs text-indigo-600 hover:underline block mt-2">
          عرض كل الإشعارات →
        </Link>
      </CardContent>
    </Card>
  );
}
