"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";

export function LoginForm({ dictionary, isAdminMode = false }: { dictionary: Dictionary; isAdminMode?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" }
  });

  const identifierLabel = isAdminMode ? "البريد الإلكتروني" : dictionary.auth.identifier;
  const identifierPlaceholder = isAdminMode ? "admin@company.com" : dictionary.auth.identifierPlaceholder;

  useEffect(() => {
    const rememberedIdentifier = window.localStorage.getItem("lana.hrms.rememberedIdentifier");
    if (rememberedIdentifier) {
      form.setValue("identifier", rememberedIdentifier);
      setRememberMe(true);
    }
  }, [form]);

  function onSubmit(values: LoginInput) {
    setMessage(null);
    if (rememberMe) window.localStorage.setItem("lana.hrms.rememberedIdentifier", values.identifier);
    else window.localStorage.removeItem("lana.hrms.rememberedIdentifier");

    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.success) setMessage(result.message);
    });
  }

  const inputClass = "h-12 rounded-2xl border-[#E5E7EB] bg-white/85 px-11 text-[#111827] shadow-sm transition-all placeholder:text-[#64748B]/70 focus:border-[#3F46E8] focus:ring-4 focus:ring-[#3F46E8]/10";

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {message ? (
        <Alert variant="destructive" aria-live="polite" className="rounded-2xl">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="identifier" className="font-bold text-[#262B63]">{identifierLabel}</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-[#64748B] rtl:left-auto rtl:right-4" aria-hidden="true" />
          <Input
            id="identifier"
            type={isAdminMode ? "email" : "text"}
            autoComplete={isAdminMode ? "email" : "username"}
            className={inputClass}
            placeholder={identifierPlaceholder}
            aria-invalid={Boolean(form.formState.errors.identifier)}
            {...form.register("identifier")}
          />
        </div>
        {form.formState.errors.identifier ? <p className="text-sm text-[#EF4444]" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password" className="font-bold text-[#262B63]">{dictionary.auth.password}</Label>
          <Link href="/forgot-password" className="text-sm font-bold text-[#3F46E8] underline-offset-4 transition hover:text-[#262B63] hover:underline">
            {dictionary.auth.forgotPassword}
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-[#64748B] rtl:left-auto rtl:right-4" aria-hidden="true" />
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className={inputClass} placeholder={dictionary.auth.passwordPlaceholder} aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-3.5 rounded-lg p-1 text-[#64748B] transition hover:bg-[#F7F9FC] hover:text-[#262B63] rtl:left-4 rtl:right-auto" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {form.formState.errors.password ? <p className="text-sm text-[#EF4444]" role="alert">{form.formState.errors.password.message}</p> : null}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-[#F7F9FC]/80 p-3 text-sm transition hover:border-[#3F46E8]/30 hover:bg-white">
        <span>
          <span className="block font-bold text-[#262B63]">{dictionary.auth.rememberTitle}</span>
          <span className="block text-xs text-[#64748B]">{dictionary.auth.rememberDescription}</span>
        </span>
        <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-[#E5E7EB] accent-[#3F46E8]" />
      </label>

      <Button className="relative h-12 w-full overflow-hidden rounded-2xl bg-[#3F46E8] text-base font-black text-white shadow-xl shadow-[#3F46E8]/25 transition-all hover:-translate-y-0.5 hover:bg-[#262B63] active:scale-[0.99]" type="submit" disabled={isPending}>
        <span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-500 hover:translate-x-0" />
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {dictionary.auth.submit}
      </Button>
    </form>
  );
}
