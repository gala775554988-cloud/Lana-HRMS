"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LanguageSettings() {
  const [language, setLanguage] = useState("ar");
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const savePreferences = () => {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/employee/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, timezone }),
      });
      setMessage(response.ok ? "تم حفظ إعدادات اللغة والمنطقة الزمنية." : "تعذر حفظ الإعدادات. يرجى المحاولة مرة أخرى.");
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>اللغة والمنطقة الزمنية</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-2 text-sm">
          <span className="font-medium">اللغة</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3">
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-medium">المنطقة الزمنية</span>
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3">
            <option value="Asia/Riyadh">Asia/Riyadh</option>
            <option value="UTC">UTC</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Asia/Kuwait">Asia/Kuwait</option>
          </select>
        </label>
        <Button variant="outline" onClick={savePreferences} disabled={isPending}>{isPending ? "جارٍ الحفظ..." : "حفظ التفضيلات"}</Button>
        {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}
      </CardContent>
    </Card>
  );
}
