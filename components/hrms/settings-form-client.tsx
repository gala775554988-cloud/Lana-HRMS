"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToastMessage, type ToastState } from "@/components/ui/toast-message";

type SaveAction = (prevState: ToastState, formData: FormData) => Promise<ToastState>;

export function SettingsFormClient({ action, children }: { action: SaveAction; children: React.ReactNode }) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      {children}
      <Button type="submit" disabled={isPending} className="w-full lg:col-span-3">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
        {isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
      </Button>
      <ToastMessage state={state} />
    </form>
  );
}
