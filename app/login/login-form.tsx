"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [message, setMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" }
  });

  useEffect(() => {
    const rememberedIdentifier = window.localStorage.getItem("lana.hrms.rememberedIdentifier");
    if (rememberedIdentifier) {
      form.setValue("identifier", rememberedIdentifier);
      setRememberMe(true);
    }
  }, [form]);

  function onSubmit(values: LoginInput) {
    setMessage(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      if (rememberMe) window.localStorage.setItem("lana.hrms.rememberedIdentifier", values.identifier);
      else window.localStorage.removeItem("lana.hrms.rememberedIdentifier");
      router.push(callbackUrl);
      router.refresh();
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
        <Label htmlFor="identifier">Username or National ID</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input id="identifier" type="text" autoComplete="username" className="h-11 pl-9" placeholder="admin or 1000000001" aria-invalid={Boolean(form.formState.errors.identifier)} {...form.register("identifier")} />
        </div>
        {form.formState.errors.identifier ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-11 px-9" placeholder="Enter your secure password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {form.formState.errors.password ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.password.message}</p> : null}
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-background/60 p-3 text-sm">
        <span>
          <span className="block font-medium">Remember this workspace</span>
          <span className="block text-xs text-muted-foreground">Save only your username or national ID on this device.</span>
        </span>
        <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-input" />
      </label>
      <Button className="h-11 w-full text-base" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Sign in securely
      </Button>
    </form>
  );
}