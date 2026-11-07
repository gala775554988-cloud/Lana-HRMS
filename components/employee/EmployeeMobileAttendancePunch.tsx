"use client";

import { useState, useTransition } from "react";
import { LocateFixed, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateMobileDeviceUUID } from "@/lib/employee/device-uuid";

type Result = { success: boolean; message?: string; site?: { name: string }; distanceMeters?: number; action?: string };

export function EmployeeMobileAttendancePunch() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);
  function punch(action: 'checkin' | 'checkout') {
    setMessage('جاري تحديد الموقع...');
    setResult(null);
    if (!navigator.geolocation) {
      setMessage('المتصفح لا يدعم تحديد الموقع GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      startTransition(async () => {
        setMessage('جاري التحقق من النطاق والموقع...');
        const res = await fetch('/api/employee/attendance/mobile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, deviceId: getOrCreateMobileDeviceUUID() }),
        });
        const json = await res.json();
        setResult(json);
        setMessage(json.success ? `تم تسجيل ${action === 'checkin' ? 'الدخول' : 'الخروج'} في ${json.site?.name || 'الموقع'} - المسافة ${json.distanceMeters}م` : json.message || 'فشل التسجيل');
      });
    }, (error) => {
      setMessage(error.message || 'تعذر الحصول على الموقع');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
  }

  return (
    <Card className="rounded-3xl border-primary/12 bg-gradient-to-br from-primary/8 to-white dark:border-primary/50 dark:from-primary/30 dark:to-slate-950">
      <CardHeader><CardTitle className="flex items-center gap-2"><LocateFixed className="h-5 w-5 text-primary" />تسجيل الحضور بالجوال حسب الموقع</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">يتم السماح بالتسجيل فقط إذا كنت داخل نطاق موقع مربوط بك حسب المستشفى/الفرع/الإدارة/الكفيل.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => punch('checkin')} disabled={pending}><LogIn className="ml-2 h-4 w-4" />تسجيل دخول من الجوال</Button>
          <Button variant="secondary" onClick={() => punch('checkout')} disabled={pending}><LogOut className="ml-2 h-4 w-4" />تسجيل خروج من الجوال</Button>
        </div>
        {message && <div className={`rounded-xl border p-3 text-sm ${result?.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{message}</div>}
      </CardContent>
    </Card>
  );
}
