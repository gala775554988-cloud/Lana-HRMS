import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset password" description="Enter your account email and we will send a secure reset link.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
