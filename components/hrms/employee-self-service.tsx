'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, Clock, AlertTriangle, MapPin, User, Upload } from 'lucide-react';
import { EmployeePhotoUpload } from './employee-photo-upload';

interface Props {
  employee: any;
  salaryInfo?: { baseSalary: number; currency: string } | null;
  userName?: string | null;
}

export function EmployeeSelfService({ employee, salaryInfo, userName }: Props) {
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  if (!employee) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          لم يتم ربط حسابك ببيانات موظف. يرجى التواصل مع الموارد البشرية.
        </CardContent>
      </Card>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;

  const requestTypes = [
    { key: 'leave', label: 'طلب إجازة', icon: Calendar },
    { key: 'loan', label: 'طلب سلفة', icon: CreditCard },
    { key: 'overtime', label: 'طلب أوفر تايم', icon: Clock },
    { key: 'complaint', label: 'شكوى', icon: AlertTriangle },
    { key: 'residence', label: 'تجديد إقامة', icon: User },
    { key: 'delegation', label: 'انتداب', icon: MapPin },
  ];

  const handleRequest = async (type: string, formData: any) => {
    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/hr/my-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, employeeId: employee.id, ...formData }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`تم تقديم طلب ${requestTypes.find(r => r.key === type)?.label} بنجاح!`);
        setActiveForm(null);
        setTimeout(() => setMessage(''), 4000);
      } else {
        alert(data.message || 'حدث خطأ');
      }
    } catch (e) {
      alert('فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome + Name */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مرحباً، {userName || fullName}</h1>
          <p className="text-muted-foreground">{employee.employeeNumber} • {employee.department?.name}</p>
        </div>
        <Badge variant="outline">موظف</Badge>
      </div>

      {message && <div className="p-3 bg-emerald-50 text-emerald-700 rounded">{message}</div>}

      {/* Profile + Salary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>معلوماتي الشخصية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div>
                <EmployeePhotoUpload
                  employeeId={employee.id}
                  currentPhoto={employee.profilePhotoUrl}
                  onUploaded={() => window.location.reload()}
                />
              </div>
              <div className="text-sm space-y-1 flex-1">
                <div><strong>الاسم:</strong> {fullName}</div>
                <div><strong>رقم الموظف:</strong> {employee.employeeNumber}</div>
                <div><strong>الهوية:</strong> {employee.nationalId}</div>
                {employee.phone && <div><strong>الهاتف:</strong> {employee.phone}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salary - READ ONLY */}
        <Card>
          <CardHeader>
            <CardTitle>معلومات الراتب</CardTitle>
          </CardHeader>
          <CardContent>
            {salaryInfo ? (
              <div className="text-2xl font-semibold">
                {salaryInfo.baseSalary.toLocaleString()} {salaryInfo.currency}
                <div className="text-xs text-muted-foreground mt-1">للاطلاع فقط</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد بيانات راتب حالياً</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-3">الطلبات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requestTypes.map((req) => {
            const Icon = req.icon;
            const isOpen = activeForm === req.key;

            return (
              <Card key={req.key} className={isOpen ? "ring-2 ring-primary" : ""}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Icon className="h-5 w-5" />
                  <CardTitle className="text-base">{req.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!isOpen ? (
                    <Button variant="outline" className="w-full" onClick={() => setActiveForm(req.key)}>
                      تقديم طلب
                    </Button>
                  ) : (
                    <RequestForm
                      type={req.key}
                      onSubmit={(d) => handleRequest(req.key, d)}
                      onCancel={() => setActiveForm(null)}
                      loading={submitting}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Small form component
function RequestForm({ type, onSubmit, onCancel, loading }: any) {
  const [data, setData] = useState<any>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      {type === 'leave' && (
        <>
          <div>
            <Label>نوع الإجازة</Label>
            <Input required onChange={e => setData({ ...data, leaveType: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" required onChange={e => setData({ ...data, startDate: e.target.value })} />
            <Input type="date" required onChange={e => setData({ ...data, endDate: e.target.value })} />
          </div>
          <Textarea placeholder="السبب" required onChange={e => setData({ ...data, reason: e.target.value })} />
        </>
      )}
      {type === 'loan' && (
        <>
          <Input type="number" placeholder="المبلغ" required onChange={e => setData({ ...data, amount: Number(e.target.value) })} />
          <Textarea placeholder="الغرض من السلفة" required onChange={e => setData({ ...data, notes: e.target.value })} />
        </>
      )}
      {['overtime', 'complaint', 'residence', 'delegation'].includes(type) && (
        <Textarea placeholder="التفاصيل" required onChange={e => setData({ ...data, details: e.target.value })} />
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading} className="flex-1">إرسال</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </form>
  );
}
