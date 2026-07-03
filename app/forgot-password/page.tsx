import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset password" description="Enter your username or national ID and HR administrators will verify your reset request.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
