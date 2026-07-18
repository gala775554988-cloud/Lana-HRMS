"use client";

import { useState } from "react";
import { Smartphone, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/90 bg-primary/5 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        كل حساب موجود هنا لديه صلاحية <strong>SUPER_ADMIN</strong> أو <strong>MANAGER</strong> ولذلك يتخطى قيد "جهاز واحد لكل حساب" افتراضياً.
        استخدم المفتاح لمنح الصلاحية لحساب آخر تحديداً أو لسحبها من مسؤول لا تريد استثناءه.
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{error}</div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/70 shadow-glass backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 text-start font-semibold text-slate-600 dark:text-slate-300">المستخدم</th>
              <th className="px-4 py-3 text-start font-semibold text-slate-600 dark:text-slate-300">الصلاحيات</th>
              <th className="px-4 py-3 text-start font-semibold text-slate-600 dark:text-slate-300">تعدد الأجهزة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Smartphone className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{u.name || u.username || u.email || u.id}</p>
                      <p className="truncate text-xs text-slate-400">{u.employeeLabel || u.email || u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.roleNames.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary"
                      >
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={u.canUseMultipleDevices}
                    onCheckedChange={(checked) => toggle(u.id, checked)}
                    disabled={pendingId === u.id}
                    aria-label={`تفعيل تعدد الأجهزة لـ ${u.name || u.username || u.id}`}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">لا يوجد مسؤولون (SUPER_ADMIN/MANAGER) حالياً.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
