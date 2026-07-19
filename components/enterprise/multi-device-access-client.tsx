"use client";

import { useState } from "react";
import { Smartphone, ShieldCheck, UserPlus, Loader2, RefreshCw, Unlink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

type AdminUser = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  roleNames: string[];
  canUseMultipleDevices: boolean;
  employeeLabel: string | null;
};

export function MultiDeviceAccessClient({ users }: { users: AdminUser[] }) {
  const [rows, setRows] = useState(users);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNewUserId, setSelectedNewUserId] = useState("");
  const [selectedNewUserLabel, setSelectedNewUserLabel] = useState("");

  async function toggle(userId: string, enabled: boolean) {
    setError(null);
    setPendingId(userId);
    const previous = rows;
    setRows((r) => r.map((row) => (row.id === userId ? { ...row, canUseMultipleDevices: enabled } : row)));
    try {
      const res = await fetch("/api/enterprise/users/multi-device-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, enabled })
      });
      const json = await res.json();
      if (!json.success) {
        setRows(previous);
        setError(json.message || "تعذر تحديث الصلاحية");
      }
    } catch {
      setRows(previous);
      setError("تعذر الاتصال بالخادم");
    } finally {
      setPendingId(null);
    }
  }

  async function addNewUserAccess() {
    if (!selectedNewUserId) return;
    setError(null);
    setPendingId(selectedNewUserId);
    try {
      const res = await fetch("/api/enterprise/users/multi-device-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedNewUserId, enabled: true })
      });
      const json = await res.json();
      if (json.success && json.user) {
        setRows((current) => {
          const exists = current.find((r) => r.id === json.user.id);
          if (exists) {
            return current.map((r) => (r.id === json.user.id ? { ...r, canUseMultipleDevices: true } : r));
          }
          return [json.user, ...current];
        });
        setSelectedNewUserId("");
        setSelectedNewUserLabel("");
      } else {
        setError(json.message || "تعذر إضافة الموظف");
      }
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setPendingId(null);
    }
  }

  async function handleUnbindDevice(user: AdminUser) {
    if (!confirm(`هل أنت متأكد من رغبتك في فك ارتباط الأجهزة للموظف (${user.name || user.username || user.id}) ليتمكن من تسجيل الدخول بجهاز جديد فوراً؟`)) {
      return;
    }
    setPendingId(user.id);
    try {
      const res = await fetch("/api/enterprise/reset-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || "✓ تم فك ارتباط جهاز الموظف بنجاح");
      } else {
        alert(json.message || "⚠️ فشل فك ارتباط الجهاز");
      }
    } catch {
      alert("⚠️ تعذر الاتصال بالخادم");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Add Employee / Grant Multi-Device & Unbind Control Card */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/5 to-white/90 dark:to-slate-900/90 p-6 shadow-md space-y-4">
        <div className="flex items-center gap-3 border-b border-primary/15 pb-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-sm">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">إضافة موظف أو اختيار موظف في خانة تعدد الأجهزة وصلاحية فك الارتباط</h3>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">اختر أي موظف بالمنصة لتمنحه فوراً صلاحية الدخول من أكثر من جهاز ويظهر في الجدول بالأسفل للتحكم بفك ارتباطه بضغطة زر:</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
          <div className="flex-1 min-w-0">
            <UserSearchSelect
              value={selectedNewUserId}
              initialLabel={selectedNewUserLabel}
              onChange={(userId, label) => {
                setSelectedNewUserId(userId);
                setSelectedNewUserLabel(label || "");
              }}
              placeholder="ابحث عن الموظف بالاسم، الرقم الوظيفي، أو رقم الهوية لإضافته..."
            />
          </div>
          <Button
            type="button"
            onClick={addNewUserAccess}
            disabled={!selectedNewUserId || pendingId === selectedNewUserId}
            className="bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-700 text-white font-black rounded-2xl h-11 px-6 shrink-0 shadow-lg shadow-primary/20"
          >
            {pendingId === selectedNewUserId ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <UserPlus className="h-4 w-4 me-2" />}
            <span>إضافة الموظف ومنحه الصلاحية فوراً</span>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        أي موظف تقوم بإضافته أو منحه صلاحية تعدد الأجهزة يظهر في الجدول أدناه، وبإمكانك تشغيل أو إيقاف تعدد الأجهزة له، أو الضغط على زر <strong>(🔓 فك ارتباط جهاز الموظف الآن)</strong> للسماح له بالدخول من جهاز جديد فوراً.
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>
      ) : null}

      {/* 2. Live Table of Employees with Multi-Device Access and Unbind Actions */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/80 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/70 dark:border-slate-800">
            <tr>
              <th className="px-5 py-4 text-start font-extrabold text-slate-700 dark:text-slate-200">الموظف / المسؤول</th>
              <th className="px-5 py-4 text-start font-extrabold text-slate-700 dark:text-slate-200">الصلاحيات والمنصب</th>
              <th className="px-5 py-4 text-center font-extrabold text-slate-700 dark:text-slate-200 w-36">تعدد الأجهزة</th>
              <th className="px-5 py-4 text-center font-extrabold text-slate-700 dark:text-slate-200 w-56">فك ارتباط الأجهزة (Unbind)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {rows.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black shadow-2xs">
                      <Smartphone className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900 dark:text-slate-100 text-sm">{u.name || u.username || u.email || u.id}</p>
                      <p className="truncate text-xs text-muted-foreground font-medium mt-0.5">{u.employeeLabel || u.email || u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {u.roleNames.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary dark:bg-primary/15"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex justify-center">
                    <Switch
                      checked={u.canUseMultipleDevices}
                      onCheckedChange={(checked) => toggle(u.id, checked)}
                      disabled={pendingId === u.id}
                      aria-label={`تفعيل تعدد الأجهزة لـ ${u.name || u.username || u.id}`}
                    />
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnbindDevice(u)}
                    disabled={pendingId === u.id}
                    className="rounded-xl border-amber-300/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-300 font-extrabold text-xs h-9 px-4 gap-1.5 shadow-2xs"
                  >
                    {pendingId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                    <span>🔓 فك ارتباط جهاز الموظف الآن</span>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-slate-400 font-semibold">لا يوجد موظفون مضافون لصلاحية تعدد الأجهزة بعد. استخدم البحث أعلاه لإضافة أول موظف الآن.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
