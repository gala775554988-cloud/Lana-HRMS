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
    </AuthCard>
  );
}
