import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginForm } from "./login-form";
import Link from "next/link";

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        
        {/* Main Login Form */}
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

        {/* Super Admin Login - Placed UNDER the form */}
        <div className="mt-6 text-center">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm"
          >
            <span className="text-lg">👑</span>
            <span>دخول المسؤولين (لوحة التحكم الكاملة)</span>
          </Link>
          
          <p className="mt-2 text-xs text-slate-500">
            استخدم البريد الإلكتروني + كلمة المرور
          </p>
        </div>

      </div>
    </div>
  );
}
