"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssetSyncButton({ allowed }: { allowed: boolean }) {
  const router = useRouter();
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [connectionId, setConnectionId] = useState("");
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    fetch("/api/enterprise/assets/sync", { signal: controller.signal }).then(r => r.json()).then(data => { if (controller.signal.aborted) return; setConnections(data.connections ?? []); if (data.connections?.length === 1) setConnectionId(data.connections[0].id); }).catch(() => {});
    return () => controller.abort();
  }, [allowed]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setBusy(true);
    setMessage("جارٍ استيراد العهد ومطابقتها بالموظفين…");
    try {
      const response = await fetch("/api/enterprise/assets/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(connectionId ? { connectionId } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "تعذر استيراد العهد");
      setMessage(`تمت إضافة ${result.created} عهدة وتحديث ${result.updated} عهدة.${result.pending ? ` توجد ${result.pending} طلبات لم تُسند بعد أو رُفضت، لم تُسجل كعهد مسلّمة.` : ""}${result.skipped ? ` تعذّر استيراد ${result.skipped} عهدة؛ أرقام السجلات: ${(result.errors ?? []).map((item: { id: number }) => item.id).join("، ")}. راجع مطابقة الموظفين وصلاحيات الاتصال.` : ""}`);
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
        <p className="mt-1 text-xs text-muted-foreground">استيراد العهد العينية المسندة للموظفين وتحديث العهد المعادة، مع حفظ تواريخ التسليم.</p>
        {!allowed && <p className="mt-2 text-sm text-muted-foreground">تشغيل المزامنة يتطلب صلاحية إدارة التكامل في حسابك.</p>}
        {message && <p role="status" className="mt-2 max-w-xl text-sm">{message}</p>}
        {allowed && <a href="/integrations/connections" className="mt-2 inline-block text-xs underline">إعداد اتصال أودو واختباره</a>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
      {connections.length > 0 && <select aria-label="اتصال أودو للعهد" className="h-10 rounded-xl border bg-background px-3 text-sm" disabled={busy} value={connectionId} onChange={event => setConnectionId(event.target.value)}><option value="">الاتصال التلقائي</option>{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select>}
      <Button variant="outline" disabled={busy || !allowed} onClick={sync}><RefreshCw className={`me-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "جارٍ الاستيراد…" : "مزامنة العهد من أودو"}</Button>
      </div>
    </section>
  );
}
