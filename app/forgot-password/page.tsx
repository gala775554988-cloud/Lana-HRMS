import { AuthCard } from "@/components/auth/auth-card";
import { getRequestDictionary } from "@/lib/i18n-server";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <AuthCard title="Reset password" description="Enter your username or national ID and HR administrators will verify your reset request." locale={locale} dictionary={dictionary}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
