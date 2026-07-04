import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRecentTasks } from '@/lib/employee/data';

export async function RecentActivity({ employeeId }: { employeeId: string }) {
  const tasks = await getRecentTasks(employeeId);

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">النشاط الأخير</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">لا يوجد نشاط حديث</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div key={index} className="flex justify-between items-start text-sm">
                <div>
                  <div>{task.title}</div>
                  {task.dueDate && <div className="text-xs text-slate-400">{task.dueDate}</div>}
                </div>
                <Badge variant="outline" className="text-xs">{task.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
