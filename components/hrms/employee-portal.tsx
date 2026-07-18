'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, CreditCard, Clock, User, 
  Bell, Home, FileText, CheckCircle, 
  Briefcase, Wallet, Clock as ClockIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { EmployeePhotoUpload } from './employee-photo-upload';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  nationalId: string;
  profilePhotoUrl?: string | null;
  phone?: string | null;
  department?: { name: string } | null;
  position?: { title: string } | null;
}

interface SalaryInfo {
  baseSalary: number;
  currency: string;
}

interface Props {
  employee: Employee | null;
  salaryInfo?: SalaryInfo | null;
  userName?: string | null;
}

// Exact mock data matching the reference image
const mockAttendanceLogs = [
  { id: 1, date: '2024 مايو 24', checkIn: '08:00', checkOut: '17:00', hours: '9', status: 'مكتمل' },
  { id: 2, date: '2024 مايو 23', checkIn: '08:15', checkOut: '16:45', hours: '8.5', status: 'مكتمل' },
  { id: 3, date: '2024 مايو 22', checkIn: '08:05', checkOut: '17:10', hours: '9', status: 'مكتمل' },
];

const mockTasks = [
  { id: 1, title: 'إعداد تقرير الحملة التسويقية', time: '10:00 AM', status: 'عالية' },
  { id: 2, title: 'اجتماع فريق التسويق', time: '12:00 PM', status: 'متوسطة' },
  { id: 3, title: 'مراجعة تصاميم الإعلانات', time: '02:00 PM', status: 'عالية' },
  { id: 4, title: 'تحليل أداء الحملة', time: '04:00 PM', status: 'منخفضة' },
];

const mockNotifications = [
  { id: 1, title: 'تم الموافقة على طلب إجازتك', desc: 'إجازة سنوية • 5 أيام', time: 'قبل 15 دقيقة', iconColor: 'emerald' },
  { id: 2, title: 'تم تحديث سياسة العمل عن بعد', desc: 'السياسة الجديدة متاحة الآن', time: 'قبل ساعة', iconColor: 'blue' },
  { id: 3, title: 'موعد تقييم الأداء القادم', desc: 'الأربعاء القادم • 10:00', time: 'أمس', iconColor: 'amber' },
  { id: 4, title: 'تم استلام طلب السلفة', desc: 'رقم الطلب: LN-98234', time: 'قبل يومين', iconColor: 'violet' },
];

const mockRequests = [
  { id: 1, type: 'إجازة سنوية', date: '2024 مايو 24 - 28', status: 'معتمد', statusColor: 'emerald' },
  { id: 2, type: 'عمل عن بعد', date: '2024 مايو 20', status: 'قيد المراجعة', statusColor: 'amber' },
  { id: 3, type: 'سلفة مالية', date: '2024 أبريل 28', status: 'معتمد', statusColor: 'emerald' },
  { id: 4, type: 'إجازة مرضية', date: '2024 مايو 2', status: 'معتمد', statusColor: 'emerald' },
];

const leaveTypes = [
  'إجازة سنوية',
  'إجازة مرضية',
  'إجازة طارئة',
  'إجازة بدون راتب',
];

export function EmployeePortal({ employee, salaryInfo, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'leave' | 'tasks' | 'profile' | 'payroll' | 'requests' | 'notifications'>('home');
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Attendance
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState('09:15:30');
  const [attendanceLogs, setAttendanceLogs] = useState(mockAttendanceLogs);
  const [attendanceFilter, setAttendanceFilter] = useState<'day' | 'week' | 'month'>('day');

  // Forms
  const [leaveForm, setLeaveForm] = useState({ leaveType: '', startDate: '', endDate: '', reason: '' });
  const [loanForm, setLoanForm] = useState({ amount: '', notes: '' });
  const [otherForm, setOtherForm] = useState({ details: '' });

  const fullName = employee ? `${employee.firstName} ${employee.lastName}` : (userName || 'أحمد');
  const photo = employee?.profilePhotoUrl || null;

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
      setCurrentTime(timeStr);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!employee) {
    return <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-4 text-white">لم يتم العثور على بيانات الموظف.</div>;
  }

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setActiveForm(null);
    setSuccessMessage('');
  };

  // Check in/out
  const handleCheckInOut = () => {
    const now = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    if (!isCheckedIn) {
      setIsCheckedIn(true);
      setSuccessMessage('تم تسجيل الدخول بنجاح!');
    } else {
      const newLog = {
        id: Date.now(),
        date: new Date().toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' }),
        checkIn: '08:00',
        checkOut: now,
        hours: '8.5',
        status: 'مكتمل',
      };
      setAttendanceLogs([newLog, ...attendanceLogs]);
      setIsCheckedIn(false);
      setSuccessMessage('تم تسجيل الخروج بنجاح!');
    }
    setTimeout(() => setSuccessMessage(''), 2400);
  };

  // Submit any request
  const handleSubmitRequest = async (type: string) => {
    setSubmitting(true);
    setSuccessMessage('');

    let payload: any = { type, employeeId: employee.id };

    if (type === 'leave') payload = { ...payload, ...leaveForm };
    else if (type === 'loan') payload = { ...payload, amount: parseFloat(loanForm.amount) || 0, notes: loanForm.notes };
    else payload = { ...payload, details: otherForm.details };

    try {
      const res = await fetch('/api/hr/my-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage(`تم تقديم طلب ${type} بنجاح!`);
        setActiveForm(null);

        // Reset
        setLeaveForm({ leaveType: '', startDate: '', endDate: '', reason: '' });
        setLoanForm({ amount: '', notes: '' });
        setOtherForm({ details: '' });
      } else {
        alert(data.message || 'حدث خطأ');
      }
    } catch (e) {
      alert('فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMessage(''), 3800);
    }
  };

  // Quick actions exactly matching the reference (4 cards)
  const quickActions = [
    { key: 'leave', label: 'طلب إجازة', icon: Calendar, bg: 'bg-orange-500' },
    { key: 'overtime', label: 'طلب بدوام', icon: ClockIcon, bg: 'bg-orange-500' },
    { key: 'expense', label: 'مصاريف', icon: Wallet, bg: 'bg-blue-500' },
    { key: 'loan', label: 'سلفة مالية', icon: CreditCard, bg: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A12] text-white pb-20 overflow-x-hidden">
      {/* === HEADER: Purple gradient exactly like the image === */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-primary px-5 pt-8 pb-6 rounded-b-[2.75rem] shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              {photo ? (
                <img src={photo} alt={fullName} className="h-11 w-11 rounded-full object-cover border-2 border-white/30 ring-2 ring-white/20" />
              ) : (
                <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/20">
                  <User className="h-5.5 w-5.5 text-white" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-400 rounded-full border-[2px] border-violet-700" />
            </div>
            <div>
              <p className="text-white/70 text-[11px] tracking-[0.5px]">مرحباً</p>
              <h1 className="text-[22px] font-bold tracking-[-0.3px] leading-none">{fullName}</h1>
              <p className="text-white/60 text-[11px] mt-0.5">{employee.position?.title || 'مدير تسويق'} • {employee.employeeNumber}</p>
            </div>
          </div>

          <button 
            onClick={() => handleTabChange('notifications')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>

        {/* === 3 STAT CARDS (exact match) === */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center">
            <div className="text-[10px] text-white/60">إجمالي المتبقية</div>
            <div className="text-[28px] font-semibold tracking-[-1px] mt-0.5 leading-none">15</div>
            <div className="text-[10px] text-white/50 mt-px">يوم</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center">
            <div className="text-[10px] text-white/60">ساعات العمل</div>
            <div className="text-[28px] font-semibold tracking-[-1px] mt-0.5 leading-none">160</div>
            <div className="text-[10px] text-white/50 mt-px">ساعة</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center">
            <div className="text-[10px] text-white/60">المهام</div>
            <div className="text-[28px] font-semibold tracking-[-1px] mt-0.5 leading-none">5</div>
            <div className="text-[10px] text-white/50 mt-px">مهام</div>
          </div>
        </div>
      </div>

      {/* Success toast */}
      {successMessage && (
        <div className="mx-4 mt-3.5 bg-emerald-600 text-white text-sm px-4 py-[9px] rounded-2xl flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {successMessage}
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <div className="px-4 pt-4 pb-24 max-w-md mx-auto">

        {/* ========== HOME (Screen 1) ========== */}
        {activeTab === 'home' && (
          <div className="space-y-7">
            {/* Quick Actions - exact 4 cards from image */}
            <div>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <h2 className="font-semibold text-[15px]">الطلبات السريعة</h2>
                <button onClick={() => handleTabChange('requests')} className="text-xs text-violet-400">عرض الكل</button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (action.key === 'attendance') handleTabChange('attendance');
                        else {
                          setActiveTab('leave');
                          setActiveForm(action.key);
                        }
                      }}
                      className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 active:bg-white/15 text-right transition"
                    >
                      <div className={`${action.bg} p-2.5 rounded-xl text-white`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-sm font-medium">{action.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notifications list (exactly like image) */}
            <div>
              <h2 className="font-semibold text-[15px] mb-2.5 px-0.5">التنبيهات</h2>
              <div className="space-y-2">
                {mockNotifications.slice(0, 3).map((n, idx) => (
                  <div key={idx} className="flex gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5">
                    <div className={`mt-0.5 p-1 rounded-full ${n.iconColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : n.iconColor === 'blue' ? 'bg-blue-500/20 text-blue-400' : n.iconColor === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-violet-500/20 text-violet-400'}`}>
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 text-sm leading-tight">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs text-white/60">{n.desc}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Salary quick preview */}
            <div onClick={() => handleTabChange('payroll')} className="cursor-pointer">
              <div className="bg-gradient-to-br from-violet-600 to-primary rounded-3xl p-5 text-center">
                <div className="text-xs text-white/70 tracking-[1px]">الراتب الصافي لهذا الشهر</div>
                <div className="text-[38px] font-semibold tracking-[-1.5px] mt-0.5 leading-none">
                  {salaryInfo ? salaryInfo.baseSalary.toLocaleString() : '12,500'} <span className="text-lg align-super font-normal">ريال</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== ATTENDANCE (Screen 2) ========== */}
        {activeTab === 'attendance' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold">الحضور والانصراف</h2>
            </div>

            {/* Top tabs */}
            <div className="flex bg-white/5 rounded-full p-1 text-sm">
              {[
                { key: 'day', label: 'اليوم' },
                { key: 'week', label: 'الاسبوع' },
                { key: 'month', label: 'الشهر' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setAttendanceFilter(t.key as any)}
                  className={`flex-1 py-1.5 rounded-full transition ${attendanceFilter === t.key ? 'bg-violet-600 text-white' : 'text-white/70'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Big circular clock */}
            <div className="flex justify-center py-3">
              <div className="relative w-52 h-52 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[13px] border-violet-600/30" />
                <div className="absolute inset-[14px] rounded-full border-[13px] border-violet-500" />
                <div className="text-center z-10">
                  <div className="text-[40px] font-mono font-semibold tracking-[-2px]">{currentTime}</div>
                  <div className="text-sm text-white/70 -mt-1">ساعات العمل اليوم</div>
                  <div className="text-violet-400 text-2xl font-semibold tracking-tight mt-0.5">8 ساعات</div>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCheckInOut}
              className={`w-full h-12 rounded-2xl text-base font-semibold ${isCheckedIn ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}
            >
              {isCheckedIn ? 'تسجيل خروج' : 'تسجيل دخول'}
            </Button>

            {/* History list */}
            <div className="space-y-2">
              <div className="text-sm font-medium px-1 text-white/80">سجل الحضور</div>
              {attendanceLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{log.date}</div>
                    <div className="text-xs text-white/60">{log.checkIn} — {log.checkOut}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{log.hours} ساعات</div>
                    <Badge className="bg-emerald-600/90 text-[10px] mt-px">{log.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== LEAVE / REQUESTS (Screens 3 & 4) ========== */}
        {(activeTab === 'leave' || activeTab === 'requests') && (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-lg font-semibold">{activeTab === 'leave' ? 'طلب إجازة' : 'طلباتي'}</h2>
            </div>

            {/* Internal tabs */}
            <div className="flex bg-white/5 rounded-2xl p-1 mb-4 text-sm">
              <button onClick={() => { setActiveTab('leave'); setActiveForm(null); }} className={`flex-1 py-2 rounded-xl ${activeTab === 'leave' && !activeForm ? 'bg-violet-600' : ''}`}>
                إجازة جديدة
              </button>
              <button onClick={() => setActiveTab('requests')} className={`flex-1 py-2 rounded-xl ${activeTab === 'requests' ? 'bg-violet-600' : ''}`}>
                طلباتي
              </button>
            </div>

            {/* Quick request buttons */}
            {activeTab === 'leave' && !activeForm && (
              <div className="space-y-2.5">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button key={idx} onClick={() => setActiveForm(action.key)} className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4">
                      <div className={`${action.bg} p-2.5 rounded-xl`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-medium">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Form */}
            {activeForm && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                <div className="flex justify-between mb-4">
                  <div className="font-semibold">
                    {activeForm === 'leave' && 'إجازة جديدة'}
                    {activeForm === 'loan' && 'سلفة مالية'}
                    {activeForm === 'overtime' && 'طلب بدوام'}
                    {activeForm === 'expense' && 'مصاريف'}
                  </div>
                  <button onClick={() => setActiveForm(null)} className="text-xs text-white/60">إلغاء</button>
                </div>

                {activeForm === 'leave' && (
                  <>
                    <div className="mb-3">
                      <Label>نوع الإجازة</Label>
                      <select value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} className="mt-1 w-full bg-[#1A1A24] border border-white/10 rounded-2xl px-4 py-3 text-sm">
                        <option value="">اختر نوع الإجازة</option>
                        {leaveTypes.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><Label>من تاريخ</Label><Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" /></div>
                      <div><Label>إلى تاريخ</Label><Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" /></div>
                    </div>
                    <div><Label>ملاحظات</Label><Textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" placeholder="اكتب ملاحظاتك..." /></div>
                  </>
                )}

                {activeForm === 'loan' && (
                  <>
                    <div className="mb-3"><Label>المبلغ المطلوب (ريال)</Label><Input type="number" value={loanForm.amount} onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" placeholder="5000" /></div>
                    <div><Label>الغرض</Label><Textarea value={loanForm.notes} onChange={e => setLoanForm({ ...loanForm, notes: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" /></div>
                  </>
                )}

                {(activeForm === 'overtime' || activeForm === 'expense') && (
                  <div><Label>التفاصيل</Label><Textarea value={otherForm.details} onChange={e => setOtherForm({ details: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1 min-h-[110px]" /></div>
                )}

                <Button onClick={() => handleSubmitRequest(activeForm)} disabled={submitting} className="w-full mt-5 h-11 bg-violet-600 hover:bg-violet-700 rounded-2xl">
                  {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </Button>
              </div>
            )}

            {/* My Requests list (Screen 4) */}
            {activeTab === 'requests' && (
              <div className="space-y-2.5">
                {mockRequests.map((req, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
                    <div>
                      <div className="font-medium">{req.type}</div>
                      <div className="text-xs text-white/60">{req.date}</div>
                    </div>
                    <Badge className={`text-xs px-3 py-0.5 bg-${req.statusColor}-600/90`}>{req.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== TASKS (Screen 5) ========== */}
        {activeTab === 'tasks' && (
          <div>
            <div className="flex justify-between mb-3">
              <h2 className="font-semibold text-lg">مهامي</h2>
            </div>
            <div className="space-y-2">
              {mockTasks.map((task, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-white/60">{task.time}</div>
                  </div>
                  <Badge className="text-xs bg-rose-600/90">{task.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== PAYROLL (Screen 7) ========== */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-center text-lg">الرواتب</h2>

            <div className="bg-gradient-to-br from-violet-600 to-primary rounded-3xl py-7 px-5 text-center">
              <div className="text-xs text-white/70">الراتب الصافي</div>
              <div className="text-[42px] font-semibold tracking-[-1.5px] mt-1">
                {salaryInfo ? salaryInfo.baseSalary.toLocaleString() : '12,500'} <span className="text-xl">ريال</span>
              </div>
              <div className="text-white/70 text-xs">ريال سعودي</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 text-sm space-y-[13px]">
              <div className="flex justify-between"><span className="text-white/70">الراتب الأساسي</span><span>١٨,٠٠٠</span></div>
              <div className="flex justify-between"><span className="text-white/70">الاستقطاعات</span><span className="text-rose-400">-٥,٥٠٠</span></div>
              <div className="flex justify-between pt-2 border-t border-white/10"><span>صافي الراتب</span><span className="font-semibold text-emerald-400">١٢,٥٠٠ ريال</span></div>
            </div>

            <div>
              <div className="text-xs text-white/70 mb-2">سجل الرواتب</div>
              {['2024 أبريل', '2024 مارس', '2024 فبراير'].map((m, i) => (
                <div key={i} className="flex justify-between bg-white/5 px-4 py-3 rounded-2xl text-sm mb-1.5">
                  <span>{m}</span><span className="font-medium">١٢,٥٠٠ ريال</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== PROFILE (Screen 6) ========== */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
            <div className="text-center pt-2">
              <EmployeePhotoUpload employeeId={employee.id} currentPhoto={photo ?? undefined} onUploaded={() => window.location.reload()} />
              <h2 className="text-2xl font-bold mt-3">{fullName}</h2>
              <p className="text-white/70 text-sm">{employee.position?.title || 'مدير تسويق'}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 text-sm space-y-3.5">
              <div className="flex justify-between"><span className="text-white/60">الاسم</span><span>{fullName}</span></div>
              <div className="flex justify-between"><span className="text-white/60">رقم الموظف</span><span>{employee.employeeNumber}</span></div>
              <div className="flex justify-between"><span className="text-white/60">الهوية الوطنية</span><span>{employee.nationalId}</span></div>
              <div className="flex justify-between"><span className="text-white/60">الإدارة</span><span>{employee.department?.name || 'التسويق'}</span></div>
              <div className="flex justify-between"><span className="text-white/60">البريد الإلكتروني</span><span>{employee.nationalId ? employee.nationalId + '@company.com' : '—'}</span></div>
              <div className="flex justify-between"><span className="text-white/60">تاريخ التعيين</span><span>2022 يناير 15</span></div>
            </div>

            <Button onClick={() => window.location.href = '/logout'} variant="outline" className="w-full rounded-2xl border-white/20 text-white">تسجيل الخروج</Button>
          </div>
        )}

        {/* ========== NOTIFICATIONS (Screen 8) ========== */}
        {activeTab === 'notifications' && (
          <div>
            <div className="flex justify-between mb-3 px-1">
              <h2 className="font-semibold">التنبيهات</h2>
            </div>
            <div className="space-y-2">
              {mockNotifications.map((n, idx) => (
                <div key={idx} className="flex gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className={`mt-0.5 p-1.5 rounded-full ${n.iconColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : n.iconColor === 'blue' ? 'bg-blue-500/20 text-blue-400' : n.iconColor === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-violet-500/20 text-violet-400'}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-white/60">{n.desc}</div>
                    <div className="text-xs text-white/40 mt-1">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* === BOTTOM NAV (exact match) === */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#11111A] border-t border-white/10 z-50">
        <div className="grid grid-cols-5 text-[10px]">
          {[
            { key: 'home', label: 'الرئيسية', icon: Home },
            { key: 'attendance', label: 'الحضور', icon: Clock },
            { key: 'tasks', label: 'المهام', icon: FileText },
            { key: 'requests', label: 'الطلبات', icon: Briefcase },
            { key: 'profile', label: 'الملف', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => handleTabChange(item.key as any)} className={`flex flex-col items-center py-[9px] ${active ? 'text-violet-400' : 'text-white/50'}`}>
                <Icon className="h-5 w-5 mb-px" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
