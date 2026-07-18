"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, IdCard, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { getOrCreateMobileDeviceUUID } from "@/lib/employee/device-uuid";

export function LoginForm({ dictionary }: { dictionary: Dictionary }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shaking, setShaking] = useState(false);
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

  // Re-triggers the shake on every failed submit (even repeat failures with
  // the same message) without remounting the inputs -- onSubmit always
  // resets message to null first, so this always sees a real transition.
  useEffect(() => {
    if (!message) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 400);
    return () => clearTimeout(timer);
  }, [message]);

  function onSubmit(values: LoginInput) {
    setMessage(null);
    if (rememberMe) window.localStorage.setItem("lana.hrms.rememberedIdentifier", values.identifier);
    else window.localStorage.removeItem("lana.hrms.rememberedIdentifier");
    const deviceId = getOrCreateMobileDeviceUUID();
    startTransition(async () => {
      const result = await loginAction({ ...values, deviceId });
      if (result.success) {
        // A hard navigation here, not router.push(). A soft/transition-based
        // push landed users on a permanently blank page whenever the
        // destination route hit a (separately real, since-fixed) hydration
        // mismatch: React can abandon a transition's pending render on error
        // without falling back to anything, leaving the URL updated but the
        // DOM never actually replaced. A full navigation re-does the whole
        // request/hydration cycle from scratch the same way a fresh page
        // load does, which the same mismatch only ever produced a
        // recoverable console warning for, not a blank screen.
        window.location.href = "/";
      } else {
        setMessage(result.message);
      }
    });
  }

  const identifierError = Boolean(form.formState.errors.identifier) || Boolean(message);
  const passwordError = Boolean(form.formState.errors.password) || Boolean(message);

  return (
    <form className="space-y-7" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {message ? (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 duration-300">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div
        className={`animate-in fade-in slide-in-from-bottom-2 relative border-b-2 pb-1.5 pt-3 duration-500 fill-mode-both focus-within:border-primary ${identifierError ? "border-destructive" : "border-slate-200 dark:border-slate-700"} ${shaking && identifierError ? "animate-shake" : ""}`}
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
            className="pointer-events-none absolute start-0 top-1 origin-left rtl:origin-right -translate-y-5 scale-75 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-300 ease-in-out peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary dark:text-slate-400 dark:peer-placeholder-shown:text-slate-500"
          >
            اسم المستخدم أو رقم الهوية
          </Label>
          <IdCard className="pointer-events-none absolute end-0 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">للموظفين: استخدم رقم الهوية وكلمة المرور (آخر 4 أرقام من الهوية)</p>
        {form.formState.errors.identifier ? <p className="text-xs text-destructive" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <div
        className={`animate-in fade-in slide-in-from-bottom-2 relative border-b-2 pb-1.5 pt-3 delay-100 duration-500 fill-mode-both focus-within:border-primary ${passwordError ? "border-destructive" : "border-slate-200 dark:border-slate-700"} ${shaking && passwordError ? "animate-shake" : ""}`}
      >
        <div className="flex items-center justify-end">
          <span className="text-xs font-medium text-primary">إذا نسيت كلمة المرور يرجى مراجعة إدارة الموارد البشرية</span>
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
            className="pointer-events-none absolute start-0 top-1 origin-left rtl:origin-right -translate-y-5 scale-75 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-300 ease-in-out peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary dark:text-slate-400 dark:peer-placeholder-shown:text-slate-500"
          >
            {dictionary.auth.password}
          </Label>
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute end-0 top-1.5 rounded p-1 text-muted-foreground transition-colors duration-300 ease-in-out hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
      </div>
      <label className="animate-in fade-in slide-in-from-bottom-2 flex cursor-pointer items-center gap-2.5 select-none delay-200 duration-500 fill-mode-both">
        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-input text-primary transition-all duration-300 ease-in-out focus-visible:ring-primary" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{dictionary.auth.rememberTitle}</span>
      </label>
      <Button
        className="h-12 w-full animate-in fade-in slide-in-from-bottom-2 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 delay-300 duration-500 fill-mode-both active:scale-95"
        type="submit"
        disabled={isPending}
      >
        {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}{dictionary.auth.submit}
      </Button>
    </form>
  );
}
