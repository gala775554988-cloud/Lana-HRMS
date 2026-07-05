import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginForm } from "./login-form";
import Link from "next/link";

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        {/* Normal Login */}
        <AuthCard 
          title={dictionary.auth.title} 
          description={dictionary.auth.description} 
          locale={locale} 
          dictionary={dictionary}
        >
          <Suspense>
            <LoginForm dictionary={dictionary} />
          </Suspense>
          
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <strong>ملاحظة للموظفين:</strong> استخدم <span className="font-mono font-bold">رقم الهوية الوطنية</span> كاسم مستخدم.
          </div>
        </AuthCard>

        {/* Super Admin Login - "بطل خارق" */}
        <div className="text-center">
          <div className="mb-2">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full">
              👑 دخول المسؤولين
            </span>
          </div>
          
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span>تسجيل الدخول كمسؤول (لوحة التحكم الكاملة)</span>
            <span className="text-lg">→</span>
          </Link>
          
          <p className="mt-1 text-[10px] text-slate-400">
            استخدم البريد الإلكتروني + كلمة المرور
          </p>
        </div>
      </div>
    </div>
  );
}
