'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function TasksPage({ tasks }: { tasks: any[] }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">المهام</h1>
      {tasks.length === 0 ? (
        <div className="text-muted-foreground">لا توجد مهام حالياً.</div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 flex justify-between">
                <div>{task.title}</div>
                <Badge>{task.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
