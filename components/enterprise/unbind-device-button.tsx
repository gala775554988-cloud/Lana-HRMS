"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Smartphone } from "lucide-react";

interface UnbindDeviceButtonProps {
  employeeId: string;
  className?: string;
  onUnbound?: () => void;
}

/**
 * Unbind Mobile Device Button (`UnbindDeviceButton`)
 * --------------------------------------------------
 * 1. Checks device binding status via `/api/enterprise/check-device?employeeId=...`.
 * 2. Displays exact status: `{isBound ? "فك ربط الجهاز (فعال)" : "تم فك الارتباط"}`.
 * 3. On click (`handleUnbind`), posts to `/api/enterprise/reset-device`, purges local
 *    storage push identifiers/device UUIDs, and reloads/updates state.
 */
export function UnbindDeviceButton({ employeeId, className = "", onUnbound }: UnbindDeviceButtonProps) {
  const [isBound, setIsBound] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    setIsChecking(true);
    fetch(`/api/enterprise/check-device?employeeId=${encodeURIComponent(employeeId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setIsBound(Boolean(data.isBound));
        }
      })
      .catch(() => setIsBound(false))
      .finally(() => setIsChecking(false));
  }, [employeeId]);

  const handleUnbind = async () => {
    if (!confirm("هل أنت متأكد من فك ربط جهاز الجوال للموظف؟ سيتم السماح له بتسجيل الدخول وبصمة الحضور من جهاز جديد.")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/enterprise/reset-device", {
        method: "POST",
        body: JSON.stringify({ employeeId }),
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsBound(false);
        try {
          window.localStorage.removeItem("lana.hrms.registered-fcm-token");
          window.localStorage.removeItem("lana.device.uuid");
          window.localStorage.removeItem("lana_mobile_secure_device_uuid");
        } catch {}
        if (onUnbound) onUnbound();
        alert("تم فك ربط الجهاز بنجاح؛ يمكن للموظف الآن الدخول من هاتف جديد.");
      } else {
        alert(data.message || "تعذر فك الارتباط؛ قد لا يكون الموظف مربوطاً بجهاز حالياً.");
      }
    } catch (err) {
      alert("حدث خطأ أثناء فك الارتباط بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <Button disabled variant="outline" size="sm" className={`rounded-xl text-xs gap-1.5 opacity-70 ${className}`} dir="rtl">
        <Loader2 className="animate-spin h-3.5 w-3.5" />
        <span>جاري التحقق من الجهاز...</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      disabled={!isBound || isLoading}
      onClick={handleUnbind}
      size="sm"
      className={`rounded-xl font-bold gap-2 text-white shadow-md transition-all ${
        isBound
          ? "bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white"
          : "bg-slate-200 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
      } ${className}`}
      dir="rtl"
    >
      {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : isBound ? <Smartphone className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      <span>{isBound ? "فك ربط الجهاز (فعال)" : "تم فك الارتباط"}</span>
    </Button>
  );
}
