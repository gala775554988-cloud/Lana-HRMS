"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, IdCard, Loader2 } from "lucide-react";
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
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });

  useEffect(() => {
    const id = window.localStorage.getItem("lana.hrms.rememberedIdentifier");
    if (id) { form.setValue("identifier", id); setRememberMe(true); }
  }, [form]);

  function onSubmit(values: LoginInput) {
    setMessage(null);
    if (rememberMe) window.localStorage.setItem("lana.hrms.rememberedIdentifier", values.identifier);
    else window.localStorage.removeItem("lana.hrms.rememberedIdentifier");
    startTransition(async () => {
      const result = await loginAction(values);
      if (result.success) {
        window.location.href = "/";
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <form className="space-y-7" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {message ? (<Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>) : null}
      <div className="space-y-1.5 border-b border-slate-200 pb-2 transition-colors duration-300 focus-within:border-primary dark:border-slate-700">
        <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">اسم المستخدم أو رقم الهوية</Label>
        <div className="relative">
          <Input
            id="identifier"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            className="h-9 rounded-none border-0 bg-transparent px-0 pe-7 pt-1 text-sm shadow-none placeholder:text-slate-300 focus-visible:ring-0 dark:placeholder:text-slate-600"
            placeholder="أدخل رقم الهوية أو اسم المستخدم"
            aria-invalid={Boolean(form.formState.errors.identifier)}
            {...form.register("identifier")}
          />
          <IdCard className="pointer-events-none absolute end-0 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">للموظفين: استخدم رقم الهوية وكلمة المرور (آخر 4 أرقام من الهوية)</p>
        {form.formState.errors.identifier ? <p className="text-xs text-destructive" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <div className="space-y-1.5 border-b border-slate-200 pb-2 transition-colors duration-300 focus-within:border-primary dark:border-slate-700">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{dictionary.auth.password}</Label>
          <span className="text-xs font-medium text-primary">إذا نسيت كلمة المرور يرجى مراجعة إدارة الموارد البشرية</span>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-9 rounded-none border-0 bg-transparent px-0 pe-7 pt-1 text-sm shadow-none placeholder:text-slate-300 focus-visible:ring-0 dark:placeholder:text-slate-600"
            placeholder={dictionary.auth.passwordPlaceholder}
            {...form.register("password")}
          />
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute end-0 top-1.5 rounded p-1 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 select-none">
        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus-visible:ring-primary" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{dictionary.auth.rememberTitle}</span>
      </label>
      <Button className="h-12 w-full rounded-lg text-sm font-semibold shadow-lg shadow-primary/20" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}{dictionary.auth.submit}
      </Button>
    </form>
  );
}
