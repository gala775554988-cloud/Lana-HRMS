import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Administrators sign in with username. Employees sign in with national ID.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
