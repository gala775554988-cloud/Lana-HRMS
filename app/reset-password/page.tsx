import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthCard title="Create a new password" description="Choose a strong password for your HRMS account.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
