import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Use your HRMS account credentials to continue.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
