"use client";

import { Suspense, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
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
      <div
        className={cn(
          "mb-7 flex flex-col items-center text-center transition-all duration-500 ease-out lg:items-start lg:text-start",
          exiting ? "translate-x-16 opacity-0 rtl:-translate-x-16" : "translate-x-0 opacity-100"
        )}
      >
        <div className="flex items-center gap-3">
          <BrandLogo
            href="/"
            size="hero"
            showText={false}
            logoClassName="border-slate-300 shadow-2xl shadow-primary/10 ring-4 ring-white/80 dark:border-slate-700 dark:ring-slate-800"
            imageClassName="p-2"
          />
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
            Lana <span className="font-medium text-primary">HRMS</span>
          </h1>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-400 dark:text-slate-500">البوابة الموحدة لدخول الموظفين والمسؤولين</p>
      </div>
      <div
        className={cn(
          "rounded-2xl border border-slate-200/80 bg-white p-8 shadow-glass transition-all duration-500 ease-out dark:border-slate-800 dark:bg-slate-900/70",
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
