import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginHeroContainer } from "@/components/auth/login-hero-container";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تسجيل الدخول",
  description: "تسجيل الدخول إلى نظام إدارة الموارد البشرية."
};

export default async function LoginPage() {
  const { locale, dictionary } = await getRequestDictionary().catch(() => ({
    locale: "ar" as const,
    dictionary: {} as never
  }));

  return <LoginHeroContainer dictionary={dictionary} isAr={locale === "ar"} />;
}
