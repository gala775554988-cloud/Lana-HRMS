import { Suspense } from "react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginForm } from "./login-form";
import Link from "next/link";

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">L</div>
            <span className="font-semibold text-xl">Lana HRMS</span>
          </div>
          <div className="text-sm text-slate-500">نظام إدارة الموارد البشرية</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8">
          
          {/* Employee Portal */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-3xl">👤</div>
              <div>
                <h2 className="text-2xl font-bold">تسجيل دخول الموظف</h2>
                <p className="text-slate-500 text-sm">استخدم رقم الهوية الوطنية</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6">
              <Suspense>
                <LoginForm dictionary={dictionary} />
              </Suspense>
            </div>

            <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              ملاحظة: استخدم <span className="font-mono font-bold">رقم الهوية الوطنية</span> كاسم مستخدم.
            </div>
          </div>

          {/* Admin Portal - Modern & Powerful */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl p-8 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">👑</div>
                <div>
                  <h2 className="text-3xl font-bold">دخول المسؤولين</h2>
                  <p className="text-purple-300">لوحة التحكم الكاملة • صلاحيات عالية</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-300 mb-8">
                <div className="flex items-center gap-2">✓ إدارة كاملة للموظفين</div>
                <div className="flex items-center gap-2">✓ الرواتب والحضور والإجازات</div>
                <div className="flex items-center gap-2">✓ التقارير والتحليلات المتقدمة</div>
                <div className="flex items-center gap-2">✓ إدارة الصلاحيات والمستخدمين</div>
              </div>
            </div>

            <Link 
              href="/login" 
              className="inline-flex items-center justify-center gap-3 w-full py-4 bg-white text-slate-900 font-semibold rounded-2xl hover:bg-slate-100 transition text-lg"
            >
              <span>تسجيل الدخول كمسؤول</span>
              <span>→</span>
            </Link>
            
            <p className="text-center text-xs text-slate-400 mt-4">
              استخدم البريد الإلكتروني + كلمة المرور
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
