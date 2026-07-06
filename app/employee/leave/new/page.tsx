'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function NewLeaveRequest() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error'; details?: string } | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    // Client-side validation
    if (!data.startDate || !data.endDate) {
      setLoading(false);
      setMessage({ text: 'يرجى تحديد تاريخ البداية والنهاية', type: 'error' });
      return;
    }

    if (new Date(data.endDate as string) < new Date(data.startDate as string)) {
      setLoading(false);
      setMessage({ text: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/hr/my-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'leave',
          ...data,
        }),
      });

      const result = await res.json();
      setLoading(false);

      if (result.success) {
        setMessage({ text: 'تم إرسال الطلب بنجاح', type: 'success' });
        setTimeout(() => router.push('/employee/requests'), 1500);
      } else {
        const errorInfo = result.error;
        let errorText = result.message || 'فشل تقديم الطلب';
        let errorDetails: string | undefined;
        if (errorInfo) {
          errorText = errorInfo.message || errorText;
          errorDetails = errorInfo.suggestion;
          if (errorInfo.fields?.length) {
            errorText += ' - الحقول: ' + errorInfo.fields.map((f: { field: string; message: string }) => f.field).join(', ');
          }
        }
        setMessage({ text: errorText, type: 'error', details: errorDetails });
      }
    } catch {
      setLoading(false);
      setMessage({ text: 'فشل إرسال الطلب. يرجى التحقق من اتصالك والمحاولة لاحقاً.', type: 'error' });
    }
  }, [router]);

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>طلب إجازة جديد</CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`rounded-lg p-3 text-sm mb-4 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'}`}>
              <div className="flex items-start gap-2">
                {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <div>
                  <p>{message.text}</p>
                  {message.details && <p className="text-xs mt-1 opacity-80">{message.details}</p>}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="type" value="leave" />

            <div>
              <Label>نوع الإجازة</Label>
              <select name="leaveType" className="w-full border rounded-xl p-2.5 text-sm bg-background" required defaultValue="">
                <option value="">اختر نوع الإجازة</option>
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
              <Input type="number" name="days" defaultValue="1" min="1" required />
            </div>

            <div>
              <Label>السبب</Label>
              <Textarea name="reason" placeholder="اكتب السبب..." required />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'جاري التقديم...' : 'تقديم الطلب'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
