'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewExpense() {
  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>طلب مصروفات</CardTitle></CardHeader>
      <CardContent>
        <form action="/api/hr/my-requests" method="POST" className="space-y-4">
          <input type="hidden" name="type" value="expense" />
          <div>
            <Label>المبلغ</Label>
            <Input type="number" name="amount" required />
          </div>
          <div>
            <Label>الفئة</Label>
            <Input name="category" placeholder="مواصلات / طعام / أخرى" required />
          </div>
          <div>
            <Label>الوصف</Label>
            <textarea name="description" className="w-full border p-2 rounded" />
          </div>
          <Button type="submit">تقديم طلب المصروفات</Button>
        </form>
      </CardContent>
    </Card>
  );
}
