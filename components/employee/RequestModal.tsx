'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const [formData, setFormData] = useState<any>({});
  const router = useRouter();

  if (!type) return null;

  const label = typeLabels[type] || 'طلب جديد';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/hr/my-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          ...formData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('تم تقديم الطلب بنجاح!');
        onClose();
        router.refresh();
      } else {
        alert(data.message || 'حدث خطأ');
      }
    } catch (err) {
      alert('فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'leave' && (
            <>
              <div>
                <Label>نوع الإجازة</Label>
                <Input placeholder="سنوية / مرضية" onChange={e => setFormData({ ...formData, leaveType: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>من تاريخ</Label><Input type="date" onChange={e => setFormData({ ...formData, startDate: e.target.value })} required /></div>
                <div><Label>إلى تاريخ</Label><Input type="date" onChange={e => setFormData({ ...formData, endDate: e.target.value })} required /></div>
              </div>
              <div><Label>السبب</Label><Textarea onChange={e => setFormData({ ...formData, reason: e.target.value })} /></div>
            </>
          )}

          {type === 'loan' && (
            <>
              <div><Label>المبلغ (ريال)</Label><Input type="number" onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} required /></div>
              <div><Label>الغرض</Label><Textarea onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
            </>
          )}

          {(type === 'overtime' || type === 'delegation' || type === 'definition' || type === 'complaint' || type === 'residence') && (
            <div><Label>التفاصيل</Label><Textarea onChange={e => setFormData({ ...formData, details: e.target.value })} required /></div>
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
