"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssetSyncButton({ allowed }: { allowed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setBusy(true);
    setMessage("جارٍ استيراد العهد ومطابقتها بالموظفين…");
    try {
      const response = await fetch("/api/enterprise/assets/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "تعذر استيراد العهد");
      setMessage(`اكتمل الاستيراد. تمت إضافة ${result.created} أصل وتحديث ${result.updated} أصل.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-bold">عهد أودو</h2>
        <p className="mt-1 text-xs text-muted-foreground">استيراد المعدات وربطها بالموظفين المعيّنين لها.</p>
        {!allowed && <p className="mt-2 text-sm text-muted-foreground">تشغيل المزامنة يتطلب صلاحية إدارة التكامل في حسابك.</p>}
        {message && <p role="status" className="mt-2 max-w-xl text-sm">{message}</p>}
      </div>
      <Button variant="outline" disabled={busy || !allowed} onClick={sync}><RefreshCw className={`me-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "جارٍ الاستيراد…" : "مزامنة العهد من أودو"}</Button>
    </section>
  );
}
