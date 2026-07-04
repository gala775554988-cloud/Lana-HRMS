import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRecentTasks } from '@/lib/employee/data';

export async function RecentRequests({ employeeId }: { employeeId: string }) {
  const tasks = await getRecentTasks(employeeId);

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader>
        <CardTitle className="text-base">الطلبات الأخيرة</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-sm text-slate-500">لا توجد طلبات حديثة</div>
        ) : (
          <div className="divide-y">
            {tasks.map((task, i) => (
              <div key={i} className="py-3 flex justify-between text-sm">
                <div>{task.title}</div>
                <Badge variant="outline" className="text-xs">{task.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
