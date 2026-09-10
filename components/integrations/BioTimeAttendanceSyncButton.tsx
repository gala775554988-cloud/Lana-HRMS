"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result = {
  success: boolean;
  complete?: boolean;
  message?: string;
  fetched?: number;
  saved?: number;
  checkins?: number;
  checkouts?: number;
  skippedUnknownState?: number;
  notFoundCount?: number;
  errorsCount?: number;
  unmatchedEmployeeCodes?: Array<{ empCode: string; punches: number }>;
};

export function BioTimeAttendanceSyncButton() {
  const [pending, startTransition] = useTransition();
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [configured, setConfigured] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [terminalAlias, setTerminalAlias] = useState("جهاز الحضور والأنصراف");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/integrations/biotime/connection", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!active || !json?.success) return;
        setConfigured(Boolean(json.configured));
        setBaseUrl(json.connection?.baseUrl || "");
        setUsername(json.connection?.username || "");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function saveConnection() {
    setResult(null);
    startTransition(async () => {
      const response = await fetch("/api/integrations/biotime/connection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, username, password }),
      });
      const json = await response.json().catch(() => ({ success: false, message: "Invalid response" }));
      if (json.success) {
        setConfigured(true);
        setPassword("");
        setResult({ success: true, message: "تم حفظ اتصال BioTime بصورة مشفرة. نفّذ المزامنة لاختبار الاتصال وسحب الحركات." });
      } else {
        setResult(json);
      }
    });
  }

  function syncNow() {
    setResult(null);
    startTransition(async () => {
      const response = await fetch("/api/integrations/biotime/sync-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, terminalAlias, pageSize: 200 }),
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
          اتصال ثابت ومشفّر بموقع ZKBio Time. تجمع المزامنة كل حركات اليوم وتحفظ أول دخول وآخر خروج لكل موظف.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <Input dir="ltr" inputMode="url" placeholder="رابط موقع BioTime" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          <Input dir="ltr" autoComplete="username" placeholder="اسم المستخدم" value={username} onChange={(event) => setUsername(event.target.value)} />
          <Input dir="ltr" type="password" autoComplete="new-password" placeholder={configured ? "اتركها فارغة للإبقاء على كلمة المرور" : "كلمة المرور"} value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div className="grid gap-2 md:grid-cols-[.6fr_.8fr_auto_auto]">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input value={terminalAlias} onChange={(event) => setTerminalAlias(event.target.value)} placeholder="اسم الجهاز (اختياري)" />
          <Button variant="outline" onClick={saveConnection} disabled={pending || !baseUrl || !username || (!configured && !password)} className="gap-2">
            <Save className="h-4 w-4" />
            حفظ الربط
          </Button>
          <Button onClick={syncNow} disabled={pending || !configured} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {pending ? "جاري المزامنة..." : "مزامنة فقط"}
          </Button>
        </div>
        {result ? (
          <div className={`rounded-xl border p-3 text-sm ${result.success && result.complete !== false ? "border-emerald-200 bg-emerald-50 text-emerald-900" : result.success ? "border-amber-200 bg-amber-50 text-amber-950" : "border-red-200 bg-red-50 text-red-900"}`}>
            {result.success ? (
              <div className="space-y-2">
                {result.message ? <p className="font-bold">{result.message}</p> : null}
                <div className="grid gap-2 md:grid-cols-6">
                  <div>المجلوب: <strong>{result.fetched ?? 0}</strong></div>
                  <div>المحفوظ: <strong>{result.saved ?? 0}</strong></div>
                  <div>دخول: <strong>{result.checkins ?? 0}</strong></div>
                  <div>خروج: <strong>{result.checkouts ?? 0}</strong></div>
                  <div>غير معروف: <strong>{result.skippedUnknownState ?? 0}</strong></div>
                  <div>غير موجود: <strong>{result.notFoundCount ?? 0}</strong></div>
                </div>
                {result.unmatchedEmployeeCodes?.length ? <p className="text-xs">أكواد غير مرتبطة بموظف: {result.unmatchedEmployeeCodes.map((item) => item.empCode).slice(0, 20).join(", ")}</p> : null}
              </div>
            ) : <p className="font-bold">فشلت المزامنة: {result.message}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
