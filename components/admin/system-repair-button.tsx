"use client";

import { useState, useTransition } from "react";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SystemRepairButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runRepair() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/system/repair", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setMessage(data?.message ?? "فشل إصلاح النظام");
        return;
      }
      setMessage(`تم الإصلاح: ${(data.actions ?? []).join(" | ")}`);
      setTimeout(() => window.location.reload(), 1200);
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={runRepair} disabled={isPending} className="gap-2">
        <Wrench className="h-4 w-4" />
        {isPending ? "جاري إصلاح النظام..." : "إصلاح النظام"}
      </Button>
      {message ? <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
