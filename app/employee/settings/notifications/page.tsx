'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotificationsSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>إعدادات الإشعارات</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked /> إشعارات الطلبات الجديدة
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked /> إشعارات عند الموافقة / الرفض
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" /> إشعارات الرواتب
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
