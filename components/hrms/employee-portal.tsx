'use client';

import React, { useState } from 'react';
import { 
  Calendar, CreditCard, Clock, AlertTriangle, MapPin, User, 
  DollarSign, Bell, Home, FileText, CheckCircle, Clock as ClockIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// Mock data to match the beautiful mobile mockup
const mockAttendanceLogs = [
  { id: 1, date: '2024 مايو 24', checkIn: '08:00', checkOut: '17:00', hours: '9', status: 'مكتمل' },
  { id: 2, date: '2024 مايو 23', checkIn: '08:15', checkOut: '16:45', hours: '8.5', status: 'مكتمل' },
  { id: 3, date: '2024 مايو 22', checkIn: '08:05', checkOut: '17:10', hours: '9', status: 'مكتمل' },
];

const mockTasks = [
  { id: 1, title: 'إعداد تقرير الحملة التسويقية', time: '10:00 AM', status: 'عالية', priority: 'high' },
  { id: 2, title: 'اجتماع فريق التسويق', time: '12:00 PM', status: 'متوسطة', priority: 'medium' },
  { id: 3, title: 'مراجعة تصاميم الإعلانات', time: '02:00 PM', status: 'عالية', priority: 'high' },
];

const mockNotifications = [
  { id: 1, title: 'تم الموافقة على طلب إجازتك', desc: 'إجازة سنوية • 5 أيام', time: 'قبل 15 دقيقة', color: 'emerald' },
  { id: 2, title: 'تم تحديث سياسة العمل عن بعد', desc: 'السياسة الجديدة متاحة الآن', time: 'قبل ساعة', color: 'blue' },
  { id: 3, title: 'موعد تقييم الأداء القادم', desc: 'الأربعاء القادم • 10:00', time: 'أمس', color: 'amber' },
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
  'إجازة أمومة / أبوة',
];

export function EmployeePortal({ employee, salaryInfo, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'leave' | 'tasks' | 'profile' | 'payroll' | 'requests'>('home');
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Attendance state
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState('09:15:30');
  const [attendanceLogs, setAttendanceLogs] = useState(mockAttendanceLogs);

  // Form states
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  
  const [loanForm, setLoanForm] = useState({ amount: '', notes: '' });
  const [otherForm, setOtherForm] = useState({ details: '' });

  const fullName = employee ? `${employee.firstName} ${employee.lastName}` : (userName || 'موظف');
  const photo = employee?.profilePhotoUrl;

  // Simulate live clock
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      setCurrentTime(timeStr);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-4 text-white">
        <div className="text-center">لم يتم العثور على بيانات الموظف.</div>
      </div>
    );
  }

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setActiveForm(null);
    setSuccessMessage('');
  };

  // Check-in / Check-out
  const handleCheckInOut = () => {
    const now = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    
    if (!isCheckedIn) {
      // Check in
      setIsCheckedIn(true);
      setSuccessMessage('تم تسجيل الدخول بنجاح!');
    } else {
      // Check out
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
    
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  // Submit request
  const handleSubmitRequest = async (type: string) => {
    setSubmitting(true);
    setSuccessMessage('');

    let payload: any = { type, employeeId: employee.id };

    if (type === 'leave') {
      payload = { ...payload, ...leaveForm };
    } else if (type === 'loan') {
      payload = { ...payload, amount: parseFloat(loanForm.amount), notes: loanForm.notes };
    } else {
      payload = { ...payload, details: otherForm.details };
    }

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
        
        // Reset forms
        setLeaveForm({ leaveType: '', startDate: '', endDate: '', reason: '' });
        setLoanForm({ amount: '', notes: '' });
        setOtherForm({ details: '' });

        // If leave, add to mock requests
        if (type === 'leave') {
          // In real app we would refetch
        }
      } else {
        alert(data.message || 'حدث خطأ');
      }
    } catch (e) {
      alert('فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  const quickActions = [
    { key: 'leave', label: 'طلب إجازة', icon: Calendar, color: 'bg-violet-600' },
    { key: 'loan', label: 'طلب سلفة', icon: CreditCard, color: 'bg-emerald-600' },
    { key: 'overtime', label: 'طلب أوفر تايم', icon: ClockIcon, color: 'bg-amber-600' },
    { key: 'attendance', label: 'تسجيل حضور', icon: Clock, color: 'bg-blue-600' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A12] text-white pb-20" dir="rtl">
      {/* Purple Gradient Header - Matching the mockup */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-700 px-5 pt-8 pb-6 rounded-b-3xl shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              {photo ? (
                <img 
                  src={photo} 
                  alt={fullName} 
                  className="h-12 w-12 rounded-full object-cover border-2 border-white/30 ring-2 ring-white/20" 
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-emerald-400 rounded-full border-2 border-violet-700" />
            </div>
            <div>
              <p className="text-white/70 text-xs tracking-wide">مرحباً</p>
              <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
              <p className="text-white/60 text-xs mt-0.5">{employee.position?.title || 'موظف'} • {employee.employeeNumber}</p>
            </div>
          </div>
          
          <button 
            onClick={() => handleTabChange('profile')}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition px-3 py-1.5 rounded-full text-xs"
          >
            <Bell className="h-3.5 w-3.5" /> 
            <span>تنبيهات</span>
          </button>
        </div>

        {/* Stats Row - Exactly like the mockup */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
            <div className="text-xs text-white/60">إجمالي المتبقية</div>
            <div className="text-3xl font-semibold mt-0.5 tracking-tighter">15</div>
            <div className="text-[10px] text-white/50">يوم</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
            <div className="text-xs text-white/60">ساعات العمل</div>
            <div className="text-3xl font-semibold mt-0.5 tracking-tighter">160</div>
            <div className="text-[10px] text-white/50">ساعة</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
            <div className="text-xs text-white/60">المهام</div>
            <div className="text-3xl font-semibold mt-0.5 tracking-tighter">5</div>
            <div className="text-[10px] text-white/50">مهام</div>
          </div>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mx-4 mt-4 bg-emerald-600/90 text-white px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {successMessage}
        </div>
      )}

      {/* Bottom Navigation Bar - Matches the app style */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#11111A] border-t border-white/10 z-50">
        <div className="grid grid-cols-5 text-xs">
          {[
            { key: 'home', label: 'الرئيسية', icon: Home },
            { key: 'attendance', label: 'الحضور', icon: Clock },
            { key: 'leave', label: 'الإجازات', icon: Calendar },
            { key: 'requests', label: 'طلباتي', icon: FileText },
            { key: 'profile', label: 'ملفي', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.key as any)}
                className={`flex flex-col items-center py-2.5 transition-all ${isActive ? 'text-violet-400' : 'text-white/50'}`}
              >
                <Icon className={`h-5 w-5 mb-0.5 ${isActive ? 'text-violet-400' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">

        {/* HOME / الرئيسية - Matches Screen 1 perfectly */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Quick Actions Grid */}
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-semibold text-lg">الطلبات السريعة</h2>
                <button onClick={() => handleTabChange('requests')} className="text-xs text-violet-400">عرض الكل →</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (action.key === 'attendance') handleTabChange('attendance');
                        else {
                          setActiveTab('leave');
                          setActiveForm(action.key);
                        }
                      }}
                      className="flex items-center gap-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl p-4 transition-all text-right"
                    >
                      <div className={`${action.color} p-3 rounded-xl text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{action.label}</div>
                        <div className="text-[11px] text-white/50">اضغط للتقديم</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Notifications */}
            <div>
              <h2 className="font-semibold text-lg mb-3 px-1">التنبيهات الأخيرة</h2>
              <div className="space-y-2">
                {mockNotifications.slice(0, 3).map((notif, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className={`mt-1 p-1.5 rounded-full ${notif.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : notif.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{notif.title}</div>
                      <div className="text-xs text-white/60 mt-0.5">{notif.desc}</div>
                      <div className="text-[10px] text-white/40 mt-1">{notif.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Salary Preview */}
            <div onClick={() => handleTabChange('payroll')} className="cursor-pointer">
              <div className="bg-gradient-to-br from-violet-600/90 to-indigo-600/90 rounded-3xl p-5 text-center">
                <div className="text-xs text-white/70">الراتب الصافي لهذا الشهر</div>
                <div className="text-4xl font-semibold mt-1 tracking-tighter">
                  {salaryInfo ? `${salaryInfo.baseSalary.toLocaleString()} ${salaryInfo.currency}` : '١٢,٥٠٠ ريال'}
                </div>
                <div className="text-xs text-white/50 mt-1">اضغط لعرض التفاصيل</div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE - Screen 2 */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold">الحضور والانصراف</h2>
              <p className="text-white/50 text-sm">اليوم • {new Date().toLocaleDateString('ar-SA')}</p>
            </div>

            {/* Big Circular Timer */}
            <div className="flex flex-col items-center">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[14px] border-violet-600/30" />
                <div className="absolute inset-[18px] rounded-full border-[14px] border-violet-500" />
                <div className="text-center z-10">
                  <div className="text-[42px] font-mono font-semibold tracking-tighter">{currentTime}</div>
                  <div className="text-sm text-white/70 -mt-1">ساعات العمل اليوم</div>
                  <div className="text-3xl font-semibold text-violet-400 mt-1">8 ساعات</div>
                </div>
              </div>
            </div>

            {/* Check In / Out Button */}
            <div className="px-2">
              <Button 
                onClick={handleCheckInOut}
                className={`w-full h-14 text-lg rounded-2xl font-semibold shadow-lg transition-all ${isCheckedIn ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}
              >
                {isCheckedIn ? 'تسجيل خروج' : 'تسجيل دخول'}
              </Button>
            </div>

            {/* Attendance History */}
            <div>
              <h3 className="font-medium mb-3 px-1">سجل الحضور</h3>
              <div className="space-y-2">
                {attendanceLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <div>
                      <div className="font-medium">{log.date}</div>
                      <div className="text-xs text-white/60">{log.checkIn} - {log.checkOut}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{log.hours} ساعات</div>
                      <Badge className="bg-emerald-600/80 text-[10px] mt-0.5">{log.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LEAVE + REQUESTS FORM - Screen 3 & 4 */}
        {(activeTab === 'leave' || activeTab === 'requests') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-semibold">{activeTab === 'leave' ? 'طلب إجازة' : 'طلباتي'}</h2>
            </div>

            {/* Tabs inside */}
            <div className="flex bg-white/5 rounded-2xl p-1 text-sm">
              <button 
                onClick={() => { setActiveTab('leave'); setActiveForm(null); }} 
                className={`flex-1 py-2 rounded-xl ${activeTab === 'leave' && !activeForm ? 'bg-violet-600' : ''}`}
              >
                طلب جديد
              </button>
              <button 
                onClick={() => setActiveTab('requests')} 
                className={`flex-1 py-2 rounded-xl ${activeTab === 'requests' ? 'bg-violet-600' : ''}`}
              >
                طلباتي
              </button>
            </div>

            {/* Leave Form */}
            {(activeTab === 'leave' && !activeForm) && (
              <div className="space-y-3">
                {['leave', 'loan', 'overtime'].map((type) => {
                  const label = type === 'leave' ? 'طلب إجازة' : type === 'loan' ? 'طلب سلفة' : 'طلب أوفر تايم';
                  const Icon = type === 'leave' ? Calendar : type === 'loan' ? CreditCard : Clock;
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveForm(type)}
                      className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-4"
                    >
                      <div className="p-3 bg-violet-600/80 rounded-xl"><Icon className="h-5 w-5" /></div>
                      <div className="font-medium">{label}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Actual Form */}
            {activeForm && (
              <Card className="bg-white/5 border-white/10 rounded-3xl">
                <CardContent className="p-5 space-y-5">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-lg">
                      {activeForm === 'leave' && 'طلب إجازة جديد'}
                      {activeForm === 'loan' && 'طلب سلفة مالية'}
                      {activeForm === 'overtime' && 'طلب أوفر تايم'}
                    </div>
                    <button onClick={() => setActiveForm(null)} className="text-xs text-white/60">إلغاء</button>
                  </div>

                  {activeForm === 'leave' && (
                    <>
                      <div>
                        <Label className="text-white/70">نوع الإجازة</Label>
                        <select 
                          value={leaveForm.leaveType}
                          onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                          className="w-full mt-1 bg-[#1A1A24] border border-white/10 rounded-2xl px-4 py-3 text-sm"
                        >
                          <option value="">اختر نوع الإجازة</option>
                          {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-white/70">من تاريخ</Label>
                          <Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="bg-[#1A1A24] border-white/10 text-white mt-1" />
                        </div>
                        <div>
                          <Label className="text-white/70">إلى تاريخ</Label>
                          <Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="bg-[#1A1A24] border-white/10 text-white mt-1" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-white/70">ملاحظات</Label>
                        <Textarea 
                          value={leaveForm.reason} 
                          onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                          placeholder="اكتب ملاحظاتك هنا..." 
                          className="bg-[#1A1A24] border-white/10 mt-1 min-h-[90px]" 
                        />
                      </div>
                    </>
                  )}

                  {activeForm === 'loan' && (
                    <>
                      <div>
                        <Label className="text-white/70">المبلغ المطلوب (ريال)</Label>
                        <Input type="number" value={loanForm.amount} onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" placeholder="5000" />
                      </div>
                      <div>
                        <Label className="text-white/70">الغرض من السلفة</Label>
                        <Textarea value={loanForm.notes} onChange={e => setLoanForm({ ...loanForm, notes: e.target.value })} className="bg-[#1A1A24] border-white/10 mt-1" placeholder="..." />
                      </div>
                    </>
                  )}

                  {activeForm === 'overtime' && (
                    <div>
                      <Label className="text-white/70">التفاصيل</Label>
                      <Textarea value={otherForm.details} onChange={e => setOtherForm({ details: e.target.value })} placeholder="عدد الساعات والسبب..." className="bg-[#1A1A24] border-white/10 mt-1 min-h-[110px]" />
                    </div>
                  )}

                  <Button 
                    onClick={() => handleSubmitRequest(activeForm)}
                    disabled={submitting}
                    className="w-full h-12 mt-2 bg-violet-600 hover:bg-violet-700 rounded-2xl font-medium"
                  >
                    {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* My Requests List (screen 4) */}
            {activeTab === 'requests' && (
              <div className="space-y-3">
                {mockRequests.map((req, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{req.type}</div>
                      <div className="text-xs text-white/60">{req.date}</div>
                    </div>
                    <Badge className={`bg-${req.statusColor}-600/90 text-xs px-3 py-1 rounded-full`}>{req.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TASKS - Screen 5 */}
        {activeTab === 'tasks' && (
          <div>
            <h2 className="font-semibold text-xl mb-4">مهامي</h2>
            <div className="space-y-2.5">
              {mockTasks.map((task, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div>
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-white/60">{task.time}</div>
                  </div>
                  <Badge className={`${task.priority === 'high' ? 'bg-rose-600' : 'bg-amber-500'} text-xs`}>
                    {task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAYROLL - Screen 7 */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">الرواتب</h2>
            
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-7 text-center">
              <div className="text-xs tracking-[2px] text-white/70">الراتب الصافي</div>
              <div className="text-[42px] font-semibold tracking-[-1.5px] mt-1">
                {salaryInfo ? salaryInfo.baseSalary.toLocaleString() : '12,500'} <span className="text-xl align-super">ريال</span>
              </div>
              <div className="text-white/70 text-xs">ريال سعودي</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between text-sm"><span>الراتب الأساسي</span><span className="font-medium">١٨,٠٠٠</span></div>
              <div className="flex justify-between text-sm"><span>الاستقطاعات</span><span className="font-medium text-rose-400">-٥,٥٠٠</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-white/10"><span>صافي الراتب</span><span className="font-semibold text-emerald-400">١٢,٥٠٠ ريال</span></div>
            </div>

            <div>
              <div className="text-sm text-white/70 mb-2 px-1">سجل الرواتب</div>
              <div className="space-y-2 text-sm">
                {['2024 أبريل', '2024 مارس', '2024 فبراير'].map((m, idx) => (
                  <div key={idx} className="flex justify-between bg-white/5 px-4 py-3 rounded-2xl">
                    <span>{m}</span>
                    <span className="font-medium">١٢,٥٠٠ ريال</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE - Screen 6 */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center pt-2">
              <EmployeePhotoUpload 
                employeeId={employee.id} 
                currentPhoto={photo ?? undefined} 
                onUploaded={() => window.location.reload()} 
              />
              <h2 className="text-2xl font-bold mt-3">{fullName}</h2>
              <p className="text-white/70 text-sm">{employee.position?.title || 'موظف'}</p>
            </div>

            <Card className="bg-white/5 border-white/10 rounded-3xl">
              <CardContent className="p-5 space-y-4 text-sm">
                <div className="flex justify-between"><span className="text-white/60">رقم الموظف</span><span>{employee.employeeNumber}</span></div>
                <div className="flex justify-between"><span className="text-white/60">الهوية الوطنية</span><span>{employee.nationalId}</span></div>
                <div className="flex justify-between"><span className="text-white/60">الإدارة</span><span>{employee.department?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/60">المنصب</span><span>{employee.position?.title || '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/60">الهاتف</span><span>{employee.phone || '—'}</span></div>
              </CardContent>
            </Card>

            <Button variant="outline" onClick={() => window.location.href = '/logout'} className="w-full rounded-2xl border-white/20">
              تسجيل الخروج
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
