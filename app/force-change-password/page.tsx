import { Suspense } from "react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { ForceChangePasswordForm } from "./force-change-password-form";

export default async function ForceChangePasswordPage() {
  const { dictionary } = await getRequestDictionary();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-white p-8 shadow-xl dark:bg-slate-900">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">تغيير كلمة المرور إجباري</h1>
            <p className="text-sm text-muted-foreground mt-2">
              كلمة المرور الحالية هي الافتراضية (آخر 4 أرقام من رقم الهوية). يجب تغييرها قبل استخدام النظام.
            </p>
          </div>
          <Suspense fallback={<div>جاري التحميل...</div>}>
            <ForceChangePasswordForm dictionary={dictionary} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
