import { AuthCard } from "@/components/auth/auth-card";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LogoutActions } from "./logout-actions";

export default async function LogoutPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <AuthCard
          title="تسجيل الخروج"
          description="هل أنت متأكد من تسجيل الخروج من الحساب؟"
          locale={locale}
          dictionary={dictionary}
        >
          <LogoutActions />
        </AuthCard>
      </div>
    </div>
  );
}
