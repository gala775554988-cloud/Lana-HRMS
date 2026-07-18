"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Shield, Search, UserCheck, Bell, Save, CheckCircle2, Loader2, Building2, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EmployeeSummary = {
  id: string;
  name: string;
  employeeNumber: string;
  nationalId: string;
  department?: string;
  branch?: string;
  hospitalId?: string | null;
  permissions?: string[];
};

type WorkflowRequest = {
  id: string;
  title: string;
  requesterName: string;
  module: string;
  level: number;
  createdAt: string;
};

export function EnterpriseAccessManager({
  currentHospitalName = "مستشفى لانا الطبي",
  currentHospitalId = null
}: {
  currentHospitalName?: string;
  currentHospitalId?: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    viewSalary: false,
    approveLeave: false,
    manageEmployees: false,
    manageAttendance: false,
    exportReports: false,
    hospitalSupervision: false
  });

  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const permissionLabels: Record<string, string> = {
    viewSalary: "عرض وتدقيق الرواتب والمسيرات (View Salaries)",
    approveLeave: "اعتماد طلبات الإجازات والاستئذان (Approve Leaves)",
    manageEmployees: "إدارة وتعديل بطاقات الموظفين (Manage Employees)",
    manageAttendance: "تعديل حركات الحضور والانصراف (Manage Attendance)",
    exportReports: "تصدير التقارير الإدارية والمالية (Export Reports)",
    hospitalSupervision: "صلاحية مشرف مستشفى / موقع طبي (Hospital Supervisor)"
  };

  // 1. Employee Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setMessage("");
    try {
      const res = await fetch(`/api/employees/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.success && data.employees?.length > 0) {
        const found = data.employees[0];
        setEmployee(found);
        // Map existing permissions if any
        const permsSet = new Set(found.permissions || []);
        setPermissions({
          viewSalary: permsSet.has("read:payroll") || permsSet.has("manage:payroll"),
          approveLeave: permsSet.has("manage:leave") || permsSet.has("approve:leave"),
          manageEmployees: permsSet.has("manage:employees"),
          manageAttendance: permsSet.has("manage:attendance"),
          exportReports: permsSet.has("read:reports"),
          hospitalSupervision: permsSet.has("manage:hospitals") || Boolean(found.hospitalId)
        });
      } else {
        setEmployee(null);
        setMessage("لم يتم العثور على موظف مطابق لهذا الرقم أو الهوية");
      }
    } catch {
      setMessage("حدث خطأ أثناء الاتصال بخادم البحث");
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Real Notification Push & Permissions Save
  const sendNotification = async (empName: string, empId: string, notificationMessage: string) => {
    try {
      await fetch("/api/enterprise/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: empId,
          title: "تحديث الصلاحيات الإدارية",
          body: notificationMessage,
          type: "INFO",
          pushToMobile: true // Trigger FCM / OneSignal push bridge
        })
      });
    } catch {}
  };

  const handleSave = () => {
    if (!employee) {
      setMessage("يرجى البحث واختيار موظف أولاً قبل حفظ الصلاحيات");
      return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        const activePermKeys = Object.entries(permissions)
          .filter(([, checked]) => checked)
          .map(([key]) => key);

        const response = await fetch("/api/enterprise/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: employee.id,
            permissions: activePermKeys,
            grantHospitalSupervisor: permissions.hospitalSupervision
          })
        });

        if (!response.ok) throw new Error("فشل تحديث بطاقة الصلاحيات في خادم Neon");

        await sendNotification(employee.name, employee.id, `تم تحديث وإقرار صلاحياتك الإدارية في نظام لانا الموحد (${activePermKeys.length} صلاحية فعالة).`);
        setMessage(`تم حفظ الصلاحيات للموظف (${employee.name}) وإرسال إشعار لحظي للتطبيق بنجاح.`);
      } catch (err: any) {
        setMessage(err.message || "حدث خطأ أثناء تحديث الصلاحيات");
      }
    });
  };

  // 3. Fetch Pending Hospital Workflow Requests
  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const query = currentHospitalId ? `?status=PENDING&hospitalId=${currentHospitalId}` : "?status=PENDING&limit=5";
        const res = await fetch(`/api/enterprise/requests${query}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          setRequests(data.requests.slice(0, 5));
        }
      } catch {}
    };
    fetchPendingRequests();
  }, [currentHospitalId]);

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto" dir="rtl">
      {/* 1. إدارة الصلاحيات المخصصة */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-5 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/8 dark:bg-primary/60 text-primary dark:text-primary/50 flex items-center justify-center shadow-xs">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">إدارة الصلاحيات المخصصة والتفويض</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Enterprise RBAC & Push Notification Bridge
                </CardDescription>
              </div>
            </div>
            {employee ? (
              <Badge className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-xs font-bold gap-1 shadow-xs">
                <UserCheck className="h-3.5 w-3.5" />
                <span>موظف محدد</span>
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Employee Search Box */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الهوية، الرقم الوظيفي، أو اسم الموظف..."
                className="pr-10 h-11 rounded-2xl text-xs font-semibold bg-slate-50/50 dark:bg-slate-900"
              />
            </div>
            <Button type="submit" disabled={isSearching || !searchQuery.trim()} className="h-11 rounded-2xl px-6 bg-primary hover:bg-primary font-bold gap-2">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>استعلام</span>}
            </Button>
          </form>

          {/* Selected Employee Info */}
          {employee ? (
            <div className="rounded-2xl border border-primary/80 bg-primary/40 p-4 dark:border-primary/60 dark:bg-primary/20 flex items-center justify-between gap-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {employee.name[0]}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{employee.name}</h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    #{employee.employeeNumber} • الهوية: {employee.nationalId} • {employee.department || "بدون قسم"}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEmployee(null)} className="text-xs text-slate-500 hover:text-rose-600">
                إلغاء التحديد
              </Button>
            </div>
          ) : null}

          {message ? (
            <div className={`rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2 ${
              message.includes("بنجاح")
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
            }`}>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          {/* Permissions Checkbox Grid */}
          <div className="space-y-3 pt-2">
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">الصلاحيات التنفيذية والوظيفية المتاحة:</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(permissions).map(([key, checked]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer select-none ${
                    checked
                      ? "border-primary bg-primary/30 dark:border-primary dark:bg-primary/20"
                      : "border-slate-200/80 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                    disabled={!employee}
                    className="h-4 w-4 rounded text-primary focus:ring-primary disabled:opacity-40"
                  />
                  <span className={`text-xs font-bold ${!employee ? "opacity-50" : "text-slate-800 dark:text-slate-200"}`}>
                    {permissionLabels[key] || key}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || !employee}
            className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-primary dark:hover:bg-primary font-black text-sm shadow-lg gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-primary/50" />}
            <span>حفظ الإعدادات وإرسال إشعار التفعيل للموظف</span>
          </Button>
        </CardContent>
      </Card>

      {/* 2. خانة موافقات المستشفى (مشرفي المواقع والأفرع الطبية) */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden border-t-4 border-t-teal-500">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  خانة الموافقات - {currentHospitalName}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Hospital Supervisor Approval Inbox (Level 1 Routing)
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 font-bold px-3 py-1 rounded-xl text-xs">
              <Building2 className="h-3.5 w-3.5 me-1" />
              <span>نطاق المستشفى</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {requests.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 pb-1">الطلبات المعلقة في انتظار اعتمادك المباشر:</div>
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100">{req.title}</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">المقدم: {req.requesterName} • الوحدة: {req.module}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 gap-1">
                      <Check className="h-3.5 w-3.5" /> اعتماد
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 text-xs px-3 gap-1">
                      <X className="h-3.5 w-3.5" /> رفض
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-500 flex items-center justify-center mx-auto shadow-2xs">
                <Bell className="h-6 w-6 animate-pulse" />
              </div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">لا توجد طلبات معلقة حالياً في قسمك</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                جميع طلبات الإجازات والاستئذان الخاصة بموظفي مستشفى / موقع ({currentHospitalName}) معالجة ومُحدثة بالكامل.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
