"use client";

import { Suspense, useState } from "react";
import { LoginForm } from "@/app/login/login-form";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

/**
 * Owns the logo header + glass card together (not just the form) so a
 * successful login can animate the logo "through the door" -- slide + fade
 * out -- before the hard navigation away from /login, instead of the page
 * just vanishing instantly.
 */
export function LoginCard({ dictionary }: { dictionary: Dictionary }) {
  const [exiting, setExiting] = useState(false);

  const handleLoginSuccess = () =>
    new Promise<void>((resolve) => {
      setExiting(true);
      setTimeout(resolve, 550);
    });

  return (
    <div className="w-full max-w-md">
      <div className={cn("mb-7 transition-opacity duration-300", exiting ? "opacity-0" : "opacity-100")}>
        <p className="mb-2 text-sm font-semibold text-primary">مرحبًا بعودتك</p>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-muted-foreground">أدخل بيانات حسابك للوصول إلى لوحة التحكم.</p>
      </div>
      <div
        className={cn(
          "relative rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-opacity duration-300 sm:p-8",
          exiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <Suspense>
          <LoginForm dictionary={dictionary} onLoginSuccess={handleLoginSuccess} />
        </Suspense>
      </div>
    </div>
  );
}
