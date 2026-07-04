'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const requestTypes = [
  { key: 'leave', label: 'إجازة' },
  { key: 'loan', label: 'سلفة' },
  { key: 'letter', label: 'خطاب تعريف' },
  { key: 'expense', label: 'مصروفات' },
  { key: 'other', label: 'أخرى' },
];

export function RequestsCenter({ employeeId }: { employeeId: string }) {
  const [activeType, setActiveType] = useState('leave');
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/hr/my-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, employeeId, ...form }),
      });
      alert('تم تقديم الطلب بنجاح');
      setForm({});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Types */}
      <Card className="border-slate-200 dark:border-slate-800 lg:col-span-1">
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">نوع الطلب</div>
          {requestTypes.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveType(t.key)}
              className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 text-sm transition ${activeType === t.key ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}
            >
              {t.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Form */}
      <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeType === 'leave' && (
              <>
                <div><Label>نوع الإجازة</Label><Input onChange={e => setForm({...form, leaveType: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>من</Label><Input type="date" onChange={e => setForm({...form, startDate: e.target.value})} /></div>
                  <div><Label>إلى</Label><Input type="date" onChange={e => setForm({...form, endDate: e.target.value})} /></div>
                </div>
              </>
            )}

            {(activeType === 'loan' || activeType === 'expense') && (
              <>
                <div><Label>المبلغ</Label><Input type="number" onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <div><Label>الغرض</Label><Textarea onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </>
            )}

            <div><Label>ملاحظات إضافية</Label><Textarea onChange={e => setForm({...form, details: e.target.value})} /></div>

            <Button type="submit" disabled={submitting} className="w-full">تقديم الطلب</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
