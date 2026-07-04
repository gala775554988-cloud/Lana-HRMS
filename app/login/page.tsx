import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <AuthCard title={dictionary.auth.title} description={dictionary.auth.description} locale={locale} dictionary={dictionary}>
      <Suspense>
        <LoginForm dictionary={dictionary} />
      </Suspense>
      
      {/* Helpful hint for employees */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        <strong>ملاحظة للموظفين:</strong> استخدم <span className="font-mono font-bold">رقم الهوية الوطنية</span> (مثال: 1000000001) كاسم مستخدم.
      </div>
    </AuthCard>
  );
}
