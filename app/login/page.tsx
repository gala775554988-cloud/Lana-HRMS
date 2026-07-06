import { Suspense } from "react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { BrandLogo } from "@/components/brand/brand-logo";
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
      <div className="w-full max-w-md">
        
        {/* Clean & Simple Login Card */}
        <div className="bg-white/95 rounded-3xl shadow-xl border p-8 backdrop-blur">
          <div className="mb-6">
            <BrandLogo
              href="/"
              size="md"
              subtitle={isAdminMode ? "دخول المسؤولين - لوحة التحكم الكاملة" : "نظام إدارة الموارد البشرية"}
              subtitleClassName="text-slate-500"
            />
          </div>

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
