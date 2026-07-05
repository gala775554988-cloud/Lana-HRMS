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

          {/* Small Admin Login Button - Under Sign in */}
          <div className="mt-5 pt-4 border-t text-center">
            <Link 
              href="/login" 
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-purple-600 transition-colors"
            >
              <span>👑</span>
              <span>دخول المسؤولين (لوحة التحكم الكاملة)</span>
            </Link>
            <p className="mt-1 text-[10px] text-slate-400">
              البريد الإلكتروني + كلمة المرور
            </p>
          </div>
        </AuthCard>

      </div>
    </div>
  );
}
