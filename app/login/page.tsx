import { Suspense } from "react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginForm } from "./login-form";
import Link from "next/link";

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        {/* Clean & Simple Login Card */}
        <div className="bg-white rounded-3xl shadow-xl border p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl">L</div>
            <div>
              <div className="font-bold text-2xl">Lana HRMS</div>
              <div className="text-xs text-slate-500 -mt-0.5">نظام إدارة الموارد البشرية</div>
            </div>
          </div>

          <Suspense>
            <LoginForm dictionary={dictionary} />
          </Suspense>

          <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
            ملاحظة: استخدم <span className="font-mono font-bold">رقم الهوية الوطنية</span> كاسم مستخدم.
          </div>

          {/* Small Hidden Admin Link */}
          <div className="mt-6 pt-5 border-t text-center">
            <Link 
              href="/login" 
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 transition-colors"
            >
              <span>👑</span>
              <span>دخول المسؤولين (لوحة التحكم)</span>
            </Link>
            <p className="text-[10px] text-slate-400 mt-1">البريد الإلكتروني + كلمة المرور</p>
          </div>
        </div>

      </div>
    </div>
  );
}
