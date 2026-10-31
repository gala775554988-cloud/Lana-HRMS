"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";

export function LoginForm({ dictionary, onLoginSuccess }: { dictionary: Dictionary; onLoginSuccess?: () => void | Promise<void> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    const id = window.localStorage.getItem("lana.hrms.rememberedIdentifier");
    if (id && /^\d{10}$/.test(id)) { form.setValue("identifier", id); setRememberMe(true); }
  }, [form]);

  function onSubmit(values: LoginInput) {
    setMessage(null);
    if (rememberMe) window.localStorage.setItem("lana.hrms.rememberedIdentifier", values.identifier);
    else window.localStorage.removeItem("lana.hrms.rememberedIdentifier");
    startTransition(async () => {
      try {
        const result = await loginAction(values);
        if (result.success) await finishLogin();
        else setMessage(result.message);
      } catch {
        setMessage("تعذر تسجيل الدخول. أعد المحاولة.");
      }
    });
  }

  async function finishLogin() {
    if (onLoginSuccess) await onLoginSuccess();
    window.location.href = "/";
  }

  const identifierError = Boolean(form.formState.errors.identifier) || Boolean(message);
  const passwordError = Boolean(form.formState.errors.password) || Boolean(message);

  return (
    <form className="space-y-7" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {/* Login page uses a scoped navy (#1E3A64) accent, pixel-matched to
          the real Lana logo -- not the shared --primary token -- so this
          page's identity stays fixed regardless of what --primary resolves
          to elsewhere in the app. */}
      <div
        className={`relative border-b-2 pb-1.5 pt-3 focus-within:border-[#1E3A64] ${identifierError ? "border-destructive" : "border-slate-200 dark:border-slate-700"}`}
      >
        <div className="relative">
          <Input
            id="identifier"
            type="text"
            inputMode="text"
            maxLength={64}
            disabled={isPending}
            autoComplete="username"
            autoFocus
            placeholder=" "
            className="peer h-9 rounded-none border-0 bg-transparent px-0 pe-12 pt-1 text-sm shadow-none placeholder:text-transparent focus-visible:ring-0"
            aria-invalid={identifierError}
            {...form.register("identifier")}
          />
          <Label
            htmlFor="identifier"
            className="pointer-events-none absolute start-0 top-1 origin-left rtl:origin-right -translate-y-5 scale-75 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-300 ease-in-out peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-[#1E3A64] dark:text-slate-400 dark:peer-placeholder-shown:text-slate-500"
          >
            اسم المستخدم أو رقم الهوية
          </Label>
        </div>

        {form.formState.errors.identifier ? <p className="text-xs text-destructive" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <div
        className={`relative border-b-2 pb-1.5 pt-3 focus-within:border-[#1E3A64] ${passwordError ? "border-destructive" : "border-slate-200 dark:border-slate-700"}`}
      >
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            inputMode="text"
            disabled={isPending}
            autoComplete="current-password"
            placeholder=" "
            className="peer h-9 rounded-none border-0 bg-transparent px-0 pe-12 pt-1 text-sm shadow-none placeholder:text-transparent focus-visible:ring-0"
            aria-invalid={passwordError}
            {...form.register("password")}
          />
          <Label
            htmlFor="password"
            className="pointer-events-none absolute start-0 top-1 origin-left rtl:origin-right -translate-y-5 scale-75 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-300 ease-in-out peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-[#1E3A64] dark:text-slate-400 dark:peer-placeholder-shown:text-slate-500"
          >
            {dictionary?.auth?.password || "كلمة المرور"}
          </Label>
          <button type="button" aria-label={showPassword ? "إخفاء الأرقام" : "إظهار الأرقام"} onClick={() => setShowPassword(v => !v)} className="absolute end-0 top-1.5 rounded p-1 text-xs text-muted-foreground">{showPassword ? "إخفاء" : "إظهار"}</button>
        </div>
      </div>
      {form.formState.errors.password ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.password.message}</p> : null}
      <label className="flex cursor-pointer items-center gap-2.5 select-none">
        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-input text-[#1E3A64] focus-visible:ring-[#1E3A64]" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{dictionary?.auth?.rememberTitle || "تذكر مساحة العمل"}</span>
      </label>
      <Button
        // Solid Navy, matching the reference login mockup's submit button
        // exactly -- white text on #1E3A64 is a comfortable ~8.9:1 (WCAG AA).
        className="h-12 w-full rounded-lg bg-[#1E3A64] text-sm font-semibold text-white shadow-lg shadow-[#1E3A64]/30 hover:bg-[#18305A] active:scale-95"
        type="submit"
        disabled={isPending}
      >
        {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}{dictionary?.auth?.submit || "تسجيل الدخول"}
      </Button>
      <p className="text-xs text-muted-foreground">للموظف: أدخل رقم الهوية وكلمة المرور آخر ٤ أرقام منها، أو كلمة المرور المخصصة لحسابك.</p>
    </form>
  );
}
