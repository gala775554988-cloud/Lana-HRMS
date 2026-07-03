"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" }
  });

  function onSubmit(values: ForgotPasswordInput) {
    setMessage(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      setIsSuccess(result.success);
      setMessage(result.message);
    });
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {message ? (
        <Alert variant={isSuccess ? "default" : "destructive"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="identifier">Username or National ID</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            className="h-11 pl-9"
            placeholder="admin or 1000000001"
            aria-invalid={Boolean(form.formState.errors.identifier)}
            {...form.register("identifier")}
          />
        </div>
        {form.formState.errors.identifier ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.identifier.message}</p> : null}
      </div>
      <Button className="h-11 w-full" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Request reset support
      </Button>
      <div className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
