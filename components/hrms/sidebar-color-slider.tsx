"use client";

import React, { useState, useEffect } from "react";
import { Palette, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Primary/secondary keep their original saturation+lightness (and the ~73°
// hue offset between them established by the mint/violet brand palette) --
// only the hue itself moves with the slider, so retinting never drifts into
// washed-out or illegibly dark combinations.
const SECONDARY_HUE_OFFSET = 73;

function applyHueToDocument(hue: number) {
  const isDark = document.documentElement.classList.contains("dark");
  const primaryL = isDark ? 50 : 42;
  const secondaryHue = (hue + SECONDARY_HUE_OFFSET) % 360;
  const secondaryL = isDark ? 72 : 66;
  const root = document.documentElement.style;
  root.setProperty("--primary", `${hue} 70% ${primaryL}%`);
  root.setProperty("--accent", `${hue} 70% ${primaryL}%`);
  root.setProperty("--ring", `${hue} 70% ${primaryL}%`);
  root.setProperty("--info", `${hue} 70% ${primaryL}%`);
  root.setProperty("--sidebar-accent", `${hue} 70% ${primaryL}%`);
  root.setProperty("--secondary", `${secondaryHue} 85% ${secondaryL}%`);
}

export function SidebarColorSliderClient() {
  const [hue, setHue] = useState<number>(270);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && typeof data.sidebarHue === "number") {
          setHue(data.sidebarHue);
          applyHueToDocument(data.sidebarHue);
        }
      })
      .catch(() => {});
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setHue(val);
    applyHueToDocument(val);
    setSavedMsg(null);
  };

  const saveHueToDatabase = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebarHue: hue })
      });
      const json = await res.json();
      setSavedMsg(json.success ? "✓ تم حفظ تدرج الألوان في قاعدة البيانات بنجاح" : "⚠️ فشل حفظ التدرج في قاعدة البيانات");
    } catch {
      setSavedMsg("⚠️ حدث خطأ تقني أثناء حفظ التدرج");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="lg:col-span-2" dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary shadow-inner shrink-0">
              <Palette className="h-5.5 w-5.5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>تخصيص تدرج ألوان النظام</span>
                <Badge className="bg-primary text-primary-foreground text-[10px] font-black">مباشر</Badge>
              </CardTitle>
              <CardDescription>اسحب للتحكم الفوري في حدة تدرج الألوان الأساسية في كامل النظام، ثم احفظ إعدادك الشخصي.</CardDescription>
            </div>
          </div>
          <span
            className="inline-block h-7 w-14 rounded-xl shadow-inner border border-black/5 dark:border-white/10"
            style={{ background: `linear-gradient(135deg, hsl(${hue}, 70%, 42%) 0%, hsl(${(hue + SECONDARY_HUE_OFFSET) % 360}, 85%, 66%) 100%)` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={handleSliderChange}
            aria-label="تدرج ألوان النظام"
            className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-primary"
            style={{
              background: "linear-gradient(90deg, hsl(0,70%,45%), hsl(60,70%,45%), hsl(120,70%,45%), hsl(180,70%,45%), hsl(240,70%,45%), hsl(300,70%,45%), hsl(360,70%,45%))"
            }}
          />
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>0°</span>
            <span className="font-black text-foreground">{hue}°</span>
            <span>360°</span>
          </div>
        </div>

        {savedMsg ? (
          <div className={`p-3 rounded-xl text-xs font-bold ${savedMsg.startsWith("✓") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {savedMsg}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>يتم تطبيق التغيير فوراً عبر متغيرات CSS الأساسية للنظام.</span>
          </div>
          <Button type="button" onClick={saveHueToDatabase} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : null}
            حفظ التدرج
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
