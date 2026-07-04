'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, CreditCard, Clock, AlertTriangle, MapPin, User, 
  Upload, DollarSign 
} from 'lucide-react';
import { EmployeePhotoUpload } from './employee-photo-upload';

interface Props {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    nationalId: string;
    profilePhotoUrl?: string | null;
    phone?: string | null;
    department?: { name: string } | null;
    position?: { title: string } | null;
  } | null;
  salaryInfo?: { baseSalary: number; currency: string } | null;
  userName?: string | null;
}

export function EmployeeSelfService({ employee, salaryInfo, userName }: Props) {
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  if (!employee) {
    return <div className="p-8 text-center">لم يتم العثور على بيانات الموظف.</div>;
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;

  const requestCards = [
    { key: 'leave', label: 'طلب إجازة', icon: Calendar, desc: 'تقديم طلب إجازة' },
    { key: 'loan', label: 'طلب سلفة', icon: CreditCard, desc: 'طلب سلفة مالية' },
    { key: 'overtime', label: 'طلب أوفر تايم', icon: Clock, desc: 'ساعات عمل إضافية' },
    { key: 'complaint', label: 'شكوى', icon: AlertTriangle, desc: 'تقديم شكوى' },
    { key: 'residence', label: 'تجديد إقامة', icon: User, desc: 'تجديد الإقامة' },
    { key: 'delegation', label: 'انتداب', icon: MapPin, desc: 'طلب انتداب' },
  ];

  const handleSubmit = async (type: string, formData: Record<string, string | number | undefined>) => {
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
        setMessage(`تم تقديم طلب ${requestCards.find(r => r.key === type)?.label} بنجاح!`);
        setActiveForm(null);
        setTimeout(() => setMessage(''), 4500);
      } else {
        alert(data.message || 'حدث خطأ أثناء الإرسال');
      }
    } catch (e) {
      alert('فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Name - Very Important */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">تم تسجيل الدخول باسم</p>
          <h1 className="text-3xl font-bold">{userName || fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{employee.employeeNumber}</Badge>
            <Badge>EMPLOYEE</Badge>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg">
          {message}
        </div>
      )}

      {/* معلومات الموظف + رفع الصورة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> معلومات الموظف
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-48">
              <EmployeePhotoUpload
                employeeId={employee.id}
                currentPhoto={employee.profilePhotoUrl ?? undefined}
                onUploaded={() => window.location.reload()}
              />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-muted-foreground">الاسم:</span> {fullName}</div>
              <div><span className="text-muted-foreground">رقم الموظف:</span> {employee.employeeNumber}</div>
              <div><span className="text-muted-foreground">الهوية الوطنية:</span> {employee.nationalId}</div>
              <div><span className="text-muted-foreground">الإدارة:</span> {employee.department?.name || '—'}</div>
              <div><span className="text-muted-foreground">المنصب:</span> {employee.position?.title || '—'}</div>
              {employee.phone && <div><span className="text-muted-foreground">الهاتف:</span> {employee.phone}</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* معلومات الراتب (Read Only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> معلومات الراتب
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salaryInfo ? (
            <div>
              <div className="text-3xl font-semibold">
                {salaryInfo.baseSalary.toLocaleString()} {salaryInfo.currency}
              </div>
              <p className="text-xs text-muted-foreground mt-1">معلومات للاطلاع فقط</p>
            </div>
          ) : (
            <p className="text-muted-foreground">لا توجد بيانات راتب متاحة حالياً.</p>
          )}
        </CardContent>
      </Card>

      {/* الطلبات - كل طلب في قالب منفصل */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">الطلبات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requestCards.map((req) => {
            const Icon = req.icon;
            const isOpen = activeForm === req.key;

            return (
              <Card key={req.key} className={isOpen ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{req.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">{req.desc}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!isOpen ? (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setActiveForm(req.key)}
                    >
                      فتح النموذج
                    </Button>
                  ) : (
                     <RequestForm 
                      type={req.key} 
                      onSubmit={(d: any) => handleSubmit(req.key, d)} 
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

function RequestForm({ type, onSubmit, onCancel, loading }: { type: string; onSubmit: (data: Record<string, unknown>) => void; onCancel: () => void; loading: boolean }) {
  const [form, setForm] = useState<Record<string, unknown>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {type === 'leave' && (
        <>
          <div>
            <Label>نوع الإجازة</Label>
            <Input placeholder="سنوية / مرضية ..." required onChange={e => setForm({...form, leaveType: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>من تاريخ</Label>
              <Input type="date" required onChange={e => setForm({...form, startDate: e.target.value})} />
            </div>
            <div>
              <Label>إلى تاريخ</Label>
              <Input type="date" required onChange={e => setForm({...form, endDate: e.target.value})} />
            </div>
          </div>
          <div>
            <Label>السبب</Label>
            <Textarea required onChange={e => setForm({...form, reason: e.target.value})} />
          </div>
        </>
      )}

      {type === 'loan' && (
        <>
          <div>
            <Label>المبلغ المطلوب (ريال)</Label>
            <Input type="number" required onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} />
          </div>
          <div>
            <Label>الغرض</Label>
            <Textarea required onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </>
      )}

      {['overtime', 'complaint', 'residence', 'delegation'].includes(type) && (
        <div>
          <Label>التفاصيل</Label>
          <Textarea required placeholder="اكتب التفاصيل هنا..." onChange={e => setForm({...form, details: e.target.value})} />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">تقديم الطلب</Button>
        <Button type="button" variant="outline" onClick={onCancel}>إلغاء</Button>
      </div>
    </form>
  );
}
