'use client';

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  isOpen: boolean;
  type: string | null;
  onClose: () => void;
}

const typeLabels: Record<string, string> = {
  leave: 'طلب إجازة',
  loan: 'طلب سلفة',
  definition: 'طلب تعريف',
  delegation: 'طلب انتداب',
  overtime: 'طلب ساعات إضافية',
  document: 'رفع مستند',
  complaint: 'شكوى',
  residence: 'تجديد إقامة',
};

export function RequestModal({ isOpen, type, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error'; details?: string } | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const router = useRouter();

  const updateField = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const label = type ? (typeLabels[type] || 'طلب جديد') : '';

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/hr/my-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...formData }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (data.success) {
        setMessage({ text: 'تم إرسال الطلب بنجاح', type: 'success' });
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 1500);
      } else {
        const errorInfo = data.error;
        if (errorInfo) {
          let detailText = errorInfo.message || 'فشل تقديم الطلب';
          if (errorInfo.fields?.length) {
            detailText += '\nالحقول: ' + errorInfo.fields.map((f: { field: string; message: string }) => `${f.field}: ${f.message}`).join(', ');
          }
          setMessage({ text: detailText, type: 'error', details: errorInfo.suggestion });
        } else {
          setMessage({ text: data.message || 'فشل تقديم الطلب', type: 'error' });
        }
      }
    } catch {
      setSubmitting(false);
      setMessage({ text: 'فشل إرسال الطلب. يرجى التحقق من اتصالك بالإنترنت والمحاولة لاحقاً.', type: 'error' });
    }
  }, [type, formData, onClose, router]);

  if (!type) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        {message && (
          <div className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'}`}>
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
          {type === 'leave' && (
            <>
              <div>
                <Label>نوع الإجازة</Label>
                <select className="w-full border rounded-xl p-2.5 text-sm bg-background" onChange={e => updateField('leaveType', e.target.value)} required defaultValue="">
                  <option value="">اختر نوع الإجازة</option>
                  <option value="annual">إجازة سنوية</option>
                  <option value="sick">إجازة مرضية</option>
                  <option value="emergency">إجازة طارئة</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>من تاريخ</Label><Input type="date" onChange={e => updateField('startDate', e.target.value)} required /></div>
                <div><Label>إلى تاريخ</Label><Input type="date" onChange={e => updateField('endDate', e.target.value)} required /></div>
              </div>
              <div><Label>عدد الأيام</Label><Input type="number" defaultValue="1" onChange={e => updateField('days', e.target.value)} required /></div>
              <div><Label>السبب</Label><Textarea onChange={e => updateField('reason', e.target.value)} /></div>
            </>
          )}

          {type === 'loan' && (
            <>
              <div><Label>المبلغ (ريال)</Label><Input type="number" onChange={e => updateField('amount', e.target.value)} required /></div>
              <div><Label>الغرض</Label><Textarea onChange={e => updateField('notes', e.target.value)} /></div>
            </>
          )}

          {(type === 'overtime' || type === 'delegation' || type === 'definition' || type === 'complaint' || type === 'residence') && (
            <div><Label>التفاصيل</Label><Textarea onChange={e => updateField('details', e.target.value)} required /></div>
          )}

          {type === 'document' && (
            <div><Label>رفع ملف</Label><Input type="file" /></div>
          )}

          <div className="flex gap-2 pt-3">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'جاري الإرسال...' : 'تقديم الطلب'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
