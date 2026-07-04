'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Props {
  notifications: any[];
}

export function LatestNotifications({ notifications }: Props) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">آخر الإشعارات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد إشعارات جديدة</p>
        ) : (
          notifications.slice(0, 4).map((n, i) => (
            <div key={i} className="text-sm">
              <div className="font-medium">{n.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</div>
            </div>
          ))
        )}
        <Link href="/employee/notifications" className="text-xs text-indigo-600 hover:underline block mt-2">
          عرض كل الإشعارات →
        </Link>
      </CardContent>
    </Card>
  );
}
