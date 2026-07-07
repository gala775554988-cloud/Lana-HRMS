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

export function LoginForm({ dictionary }: { dictionary: Dictionary }) {
  const [message, setMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" }
  });

  const identifierLabel = "اسم المستخدم، البريد الإلكتروني، أو رقم الهوية الوطنية";
  const identifierPlaceholder = "admin أو 1000000001 أو name@company.com";

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

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {message ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="identifier" className="font-bold text-slate-800 dark:text-slate-200">{identifierLabel}</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" aria-hidden="true" />
          <Input 
            id="identifier" 
            type="text" 
            autoComplete="username" 
            className="h-11 pl-9 rtl:pl-3 rtl:pr-9 text-base" 
            placeholder={identifierPlaceholder} 
            aria-invalid={Boolean(form.formState.errors.identifier)} 
            {...form.register("identifier")} 
          />
        </div>
        {form.formState.errors.identifier ? <p className="text-sm text-destructive font-semibold" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password" className="font-bold text-slate-800 dark:text-slate-200">{dictionary.auth.password}</Label>
          <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {dictionary.auth.forgotPassword}
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" aria-hidden="true" />
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-11 px-9 text-base" placeholder={dictionary.auth.passwordPlaceholder} aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:text-foreground rtl:left-3 rtl:right-auto" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {form.formState.errors.password ? <p className="text-sm text-destructive font-semibold" role="alert">{form.formState.errors.password.message}</p> : null}
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border bg-slate-50/80 p-3.5 text-sm dark:bg-slate-900/50">
        <span>
          <span className="block font-bold text-slate-800 dark:text-slate-200">{dictionary.auth.rememberTitle}</span>
          <span className="block text-xs text-muted-foreground">{dictionary.auth.rememberDescription}</span>
        </span>
        <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-input text-primary" />
      </label>
      <Button className="h-12 w-full text-base font-bold shadow-lg shadow-indigo-600/20 rounded-xl" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {dictionary.auth.submit}
      </Button>
    </form>
  );
}
