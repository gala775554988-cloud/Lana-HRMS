'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function NewLeaveRequest() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const res = await fetch('/api/hr/my-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'leave',
        ...Object.fromEntries(formData),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      alert('تم تقديم طلب الإجازة. تم إنشاء سير العمل تلقائياً.');
      router.push('/employee/requests');
    } else {
      alert(data.message || 'فشل تقديم الطلب');
    }
  }

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>طلب إجازة جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="type" value="leave" />

            <div>
              <Label>نوع الإجازة</Label>
              <select name="leaveType" className="w-full border rounded-xl p-2.5 text-sm" required>
                <option value="annual">إجازة سنوية</option>
                <option value="sick">إجازة مرضية</option>
                <option value="emergency">إجازة طارئة</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" name="startDate" required />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" name="endDate" required />
              </div>
            </div>

            <div>
              <Label>عدد الأيام (تقريبي)</Label>
              <Input type="number" name="days" defaultValue="1" required />
            </div>

            <div>
              <Label>السبب</Label>
              <Textarea name="reason" placeholder="اكتب السبب..." required />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'جاري التقديم...' : 'تقديم الطلب (سيتم إنشاء سير العمل)'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
