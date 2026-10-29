"use client";

import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, IdCard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";

export function LoginForm({ dictionary, onLoginSuccess }: { dictionary: Dictionary; onLoginSuccess?: () => void | Promise<void> }) {
  const [enrollmentPending, setEnrollmentPending] = useState(false);
  const automaticAttempt = useRef("");
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
    if (id) { form.setValue("identifier", id); setRememberMe(true); }
  }, [form]);

  function onSubmit(values: LoginInput) {
    setMessage(null);
    if (rememberMe) window.localStorage.setItem("lana.hrms.rememberedIdentifier", values.identifier);
    else window.localStorage.removeItem("lana.hrms.rememberedIdentifier");
    startTransition(async () => {
      try {
        let result = await loginAction(values);
        if (result.biometricOptions) {
          if (!browserSupportsWebAuthn()) {
            setMessage("هذا المتصفح لا يدعم البصمة. أدخل رمز التفعيل للدخول.");
            return;
          }
          const response = await startAuthentication(result.biometricOptions);
          result = await loginAction({ ...values, biometricResponse: JSON.stringify(response) });
        }
        if (result.success) {
          if (result.enrollBiometric && browserSupportsWebAuthn()) {
            setEnrollmentPending(true);
            await enrollBiometric();
          } else {
            await finishLogin();
          }
        } else {
          setMessage(result.message);
        }
      } catch {
        setMessage("لم تكتمل المصادقة بالبصمة. أعد المحاولة أو أدخل رمز التفعيل للدخول.");
      }
    });
  }

  async function finishLogin() {
    if (onLoginSuccess) await onLoginSuccess();
    window.location.href = "/";
  }

  async function enrollBiometric() {
    try {
      setMessage("أكد ربط بصمة هذا الجهاز للدخول القادم.");
      const optionsResponse = await fetch("/api/auth/webauthn/register-options", { method: "POST" });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok || !options.success) throw new Error();
      const response = await startRegistration(options.options);
      const verification = await fetch("/api/auth/webauthn/register-verify", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response }),
      });
      const result = await verification.json();
      if (!verification.ok || !result.success) throw new Error();
      await finishLogin();
    } catch {
      setMessage("تم تسجيل الدخول، لكن لم تُربط البصمة. يمكنك إعادة المحاولة أو المتابعة.");
    }
  }

  const identifier = form.watch("identifier");
  const password = form.watch("password");
  const activationCode = form.watch("activationCode");
  useEffect(() => {
    if (isPending || enrollmentPending || activationCode || !/^\d{10}$/.test(identifier) || password.length !== 4 || !identifier.endsWith(password)) return;
    const attempt = `${identifier}:${password}`;
    if (automaticAttempt.current === attempt) return;
    const timer = window.setTimeout(() => {
      automaticAttempt.current = attempt;
      void form.handleSubmit(onSubmit)();
    }, 500);
    return () => window.clearTimeout(timer);
    // onSubmit reads the current form values through handleSubmit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, password, activationCode, isPending, enrollmentPending, form]);

  if (enrollmentPending) return (
    <div className="space-y-4" role="status">
      <p>{message}</p>
      <Button disabled={isPending} onClick={() => startTransition(enrollBiometric)}>إعادة ربط البصمة</Button>
      <Button variant="outline" disabled={isPending} onClick={() => void finishLogin()}>المتابعة إلى النظام</Button>
    </div>
  );

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
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            placeholder=" "
            className="peer h-9 rounded-none border-0 bg-transparent px-0 pe-7 pt-1 text-sm shadow-none placeholder:text-transparent focus-visible:ring-0"
            aria-invalid={identifierError}
            {...form.register("identifier")}
          />
          <Label
            htmlFor="identifier"
            className="pointer-events-none absolute start-0 top-1 origin-left rtl:origin-right -translate-y-5 scale-75 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-300 ease-in-out peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-[#1E3A64] dark:text-slate-400 dark:peer-placeholder-shown:text-slate-500"
          >
            اسم المستخدم أو رقم الهوية
          </Label>
          <IdCard className="pointer-events-none absolute end-0 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">للموظفين: رقم الهوية وآخر ٤ أرقام منها أو كلمة المرور التي عينها المسؤول، ثم بصمة الجهاز تلقائيًا. عند أول دخول استخدم رمز التفعيل لربط البصمة. لا يلزم بريد إلكتروني.</p>
        {form.formState.errors.identifier ? <p className="text-xs text-destructive" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <div
        className={`relative border-b-2 pb-1.5 pt-3 focus-within:border-[#1E3A64] ${passwordError ? "border-destructive" : "border-slate-200 dark:border-slate-700"}`}
      >
        <div className="flex items-center justify-end">
          {/* The identity's grey (#707070), pixel-matched to the real logo. */}
          <span className="text-xs font-medium text-[#707070]">إذا نسيت كلمة المرور يرجى مراجعة إدارة الموارد البشرية</span>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder=" "
            className="peer h-9 rounded-none border-0 bg-transparent px-0 pe-7 pt-1 text-sm shadow-none placeholder:text-transparent focus-visible:ring-0"
            aria-invalid={passwordError}
            {...form.register("password")}
          />
          <Label
            htmlFor="password"
            className="pointer-events-none absolute start-0 top-1 origin-left rtl:origin-right -translate-y-5 scale-75 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-300 ease-in-out peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-[#1E3A64] dark:text-slate-400 dark:peer-placeholder-shown:text-slate-500"
          >
            {dictionary?.auth?.password || "كلمة المرور"}
          </Label>
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute end-0 top-1.5 rounded p-1 text-muted-foreground transition-colors duration-300 ease-in-out hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
      </div>
      <div className="space-y-3">
        <Label htmlFor="activationCode">رمز التفعيل من المسؤول — ٤ أرقام</Label>
        <Input id="activationCode" type="password" inputMode="numeric" autoComplete="off" maxLength={4} dir="ltr" placeholder="••••" {...form.register("activationCode", { setValueAs: value => value?.trim() || undefined })} />
        <p className="text-xs text-muted-foreground">لأول دخول أو عند تعذر البصمة. احصل على رمزك الخاص من الموارد البشرية. المسؤول يدخل بكلمة مروره دون رمز.</p>
        {form.formState.errors.activationCode ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.activationCode.message}</p> : null}
      </div>
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
    </form>
  );
}
