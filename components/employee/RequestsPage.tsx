'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function RequestsPage({ employee, summary }: any) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الطلبات</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card><CardContent className="p-6">معلقة<br /><span className="text-3xl font-semibold">{summary.pending}</span></CardContent></Card>
        <Card><CardContent className="p-6">معتمدة<br /><span className="text-3xl font-semibold">{summary.approved}</span></CardContent></Card>
        <Card><CardContent className="p-6">مرفوضة<br /><span className="text-3xl font-semibold">{summary.rejected}</span></CardContent></Card>
      </div>

      <div className="text-sm text-muted-foreground">استخدم الإجراءات السريعة في الرئيسية لتقديم طلبات جديدة.</div>
    </div>
  );
}
