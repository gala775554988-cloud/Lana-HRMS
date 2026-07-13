"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_BIOTIME_URL = "https://handbook-latino-trout-settle.trycloudflare.com";

type Result = {
  success: boolean;
  message?: string;
  fetched?: number;
  saved?: number;
  checkins?: number;
  checkouts?: number;
  skippedUnknownState?: number;
  notFoundCount?: number;
  errorsCount?: number;
  notFound?: Array<Record<string, unknown>>;
};

export function BioTimeAttendanceSyncButton() {
  const [pending, startTransition] = useTransition();
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BIOTIME_URL);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [terminalAlias, setTerminalAlias] = useState("جهاز الحضور والأنصراف");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("lana.biotime.url");
    setBaseUrl(saved || DEFAULT_BIOTIME_URL);
  }, []);

  function syncNow() {
    setResult(null);
    window.localStorage.setItem("lana.biotime.url", baseUrl);
    startTransition(async () => {
      const response = await fetch("/api/integrations/biotime/sync-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, date, terminalAlias, pageSize: 100 }),
      });
      const json = await response.json().catch(() => ({ success: false, message: "Invalid response" }));
      setResult(json);
    });
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-slate-950">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-black text-emerald-950 dark:text-emerald-100">
          <Clock className="h-5 w-5 text-emerald-600" />
          مزامنة BioTime الآن
        </div>
        <p className="text-sm text-muted-foreground">
          اسحب حركات جهاز الحضور والانصراف من BioTime عبر رابط Cloudflare، واحفظها مباشرة في جدول الحضور.
        </p>
        <div className="grid gap-2 md:grid-cols-[1.4fr_.6fr_.8fr_auto]">
          <Input dir="ltr" placeholder="https://xxxxx.trycloudflare.com" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input value={terminalAlias} onChange={(event) => setTerminalAlias(event.target.value)} placeholder="terminal_alias" />
          <Button onClick={syncNow} disabled={pending || !baseUrl} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {pending ? "جاري المزامنة..." : "مزامنة فقط"}
          </Button>
        </div>
        {result ? (
          <div className={`rounded-xl border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-6">
                  <div>المجلوب: <strong>{result.fetched ?? 0}</strong></div>
                  <div>المحفوظ: <strong>{result.saved ?? 0}</strong></div>
                  <div>دخول: <strong>{result.checkins ?? 0}</strong></div>
                  <div>خروج: <strong>{result.checkouts ?? 0}</strong></div>
                  <div>غير معروف: <strong>{result.skippedUnknownState ?? 0}</strong></div>
                  <div>غير موجود: <strong>{result.notFoundCount ?? 0}</strong></div>
                </div>
                {result.notFound?.length ? <p className="text-xs">أكواد غير موجودة: {result.notFound.map((item) => String(item.empCode)).slice(0, 20).join(", ")}</p> : null}
              </div>
            ) : <p className="font-bold">فشلت المزامنة: {result.message}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
