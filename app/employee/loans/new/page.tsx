'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewLoan() {
  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>طلب سلفة</CardTitle></CardHeader>
      <CardContent>
        <form action="/api/hr/my-requests" method="POST" className="space-y-4">
          <input type="hidden" name="type" value="loan" />
          <div>
            <Label>المبلغ المطلوب</Label>
            <Input type="number" name="amount" required />
          </div>
          <div>
            <Label>الغرض</Label>
            <textarea name="notes" className="w-full border p-2 rounded" />
          </div>
          <Button type="submit">تقديم الطلب</Button>
        </form>
      </CardContent>
    </Card>
  );
}
