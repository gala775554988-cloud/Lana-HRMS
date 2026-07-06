import { Suspense } from "react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { LoginForm } from "./login-form";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const { locale, dictionary } = await getRequestDictionary();
  const params = await searchParams;
  const isAdminMode = params.admin === "true";

  return (
    <div className="min-h-screen bg-slate-50/90 flex items-center justify-center p-6">
      <div className="absolute end-4 top-4">
        <ClientLanguageToggle variant="outline" />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandLogo
            href="/"
            size="hero"
            showText={false}
            logoClassName="border-slate-300 shadow-2xl shadow-indigo-950/20 ring-4 ring-white/80"
            imageClassName="p-2"
          />
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Lana HRMS</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {isAdminMode ? "دخول المسؤولين - لوحة التحكم الكاملة" : "نظام إدارة الموارد البشرية"}
          </p>
        </div>
        
        {/* Clean & Simple Login Card */}
        <div className="bg-white/95 rounded-3xl shadow-xl border p-8 backdrop-blur">

          <Suspense>
            <LoginForm dictionary={dictionary} isAdminMode={isAdminMode} />
          </Suspense>

          {!isAdminMode && (
            <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              ملاحظة: استخدم <span className="font-mono font-bold">رقم الهوية الوطنية</span> كاسم مستخدم.
            </div>
          )}

          {isAdminMode && (
            <div className="mt-4 text-xs text-purple-600 bg-purple-50 p-3 rounded-xl flex items-center gap-2">
              <span>👑</span>
              <span>استخدم البريد الإلكتروني + كلمة المرور</span>
            </div>
          )}

          {/* Admin Toggle Link */}
          <div className="mt-6 pt-5 border-t text-center">
            {!isAdminMode ? (
              <Link 
                href="/login?admin=true" 
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 transition-colors"
              >
                <span>👑</span>
                <span>دخول المسؤولين (لوحة التحكم)</span>
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <span>👤</span>
                <span>العودة إلى دخول الموظف</span>
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
