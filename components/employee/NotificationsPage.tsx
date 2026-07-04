'use client';

import React from 'react';

export function NotificationsPage({ notifications }: { notifications: any[] }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الإشعارات</h1>
      {notifications.length === 0 ? <p className="text-muted-foreground">لا توجد إشعارات.</p> : (
        <div className="space-y-3">
          {notifications.map((n, i) => (
            <div key={i} className="p-4 border rounded-2xl bg-white dark:bg-slate-900">{n.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}
