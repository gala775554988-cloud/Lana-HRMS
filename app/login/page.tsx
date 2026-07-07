import { Suspense } from "react";
import { getRequestDictionary } from "@/lib/i18n-server";
import { LoginExperience } from "@/components/auth/login-experience";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const { locale, dictionary } = await getRequestDictionary();
  const params = await searchParams;
  const isAdminMode = params.admin === "true";

  return (
    <LoginExperience locale={locale} isAdminMode={isAdminMode}>
      <Suspense>
        <LoginForm dictionary={dictionary} isAdminMode={isAdminMode} />
      </Suspense>
    </LoginExperience>
  );
}
