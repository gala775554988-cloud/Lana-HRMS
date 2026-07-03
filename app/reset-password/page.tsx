import { AuthCard } from "@/components/auth/auth-card";
import { getRequestDictionary } from "@/lib/i18n-server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <AuthCard title="Create a new password" description="Choose a strong password for your HRMS account." locale={locale} dictionary={dictionary}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
