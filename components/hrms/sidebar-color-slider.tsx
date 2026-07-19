"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Palette, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  const applyHueToDocument = (val: number) => {
    document.documentElement.style.setProperty("--primary-gradient-start", `hsl(${val}, 75%, 18%)`);
    document.documentElement.style.setProperty("--primary-gradient-mid", `hsl(${val}, 68%, 28%)`);
  };

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
      if (json.success) {
        setSavedMsg("✓ تم حفظ تدرج ألوان القائمة الجانبية في قاعدة البيانات بنجاح");
      } else {
        setSavedMsg("⚠️ فشل حفظ التدرج في قاعدة البيانات");
      }
    } catch {
      setSavedMsg("⚠️ حدث خطأ تقني أثناء حفظ التدرج");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-3xl border border-primary/20 bg-gradient-to-br from-white/95 via-primary/[0.03] to-slate-50/90 dark:from-slate-900/90 dark:to-slate-950 p-6 shadow-xl space-y-5 text-right font-sans glass-card" dir="rtl">
      <CardHeader className="p-0 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-inner">
              <Palette className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>تخصيص نظام الألوان التفاعلي للشريط الجانبي (Dynamic Color Slider)</span>
                <Badge className="bg-primary text-white font-extrabold text-[10px]">CSS Variables + Prisma</Badge>
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                اسحب شريط التحكم يميناً أو يساراً للتحكم الفوري في تدرج وحدة ألوان القائمة الجانبية، مع حفظ إعداداتك الفردية برمجياً.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-6 w-12 rounded-xl shadow-inner border border-white/40"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 75%, 18%) 0%, hsl(${hue}, 68%, 28%) 100%)`
              }}
            />
            <span className="text-xs font-mono font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              Hue: {hue}°
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-5 pt-2">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>🔴 أحمر / دافئ (0°)</span>
            <span>🟣 فيروزي / بنفسجي (180° - 270°)</span>
            <span>🔵 أزرق / بارد (360°)</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={handleSliderChange}
            className="w-full h-3 bg-gradient-to-r from-red-600 via-green-500 via-blue-600 via-purple-600 to-red-600 rounded-lg appearance-none cursor-pointer accent-primary"
            style={{
              background: `linear-gradient(90deg, hsl(0, 70%, 30%), hsl(60, 70%, 30%), hsl(120, 70%, 30%), hsl(180, 70%, 30%), hsl(240, 70%, 30%), hsl(270, 75%, 20%), hsl(300, 70%, 30%), hsl(360, 70%, 30%))`
            }}
          />
        </div>

        {savedMsg ? (
          <div className={`p-3.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all duration-300 animate-in fade-in ${
            savedMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
          }`}>
            <span>{savedMsg}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 pt-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>يتغير التدرج فوراً باستخدام متغيرات الـ CSS المتصلة (<code>--primary-gradient-start</code>).</span>
          </div>
          <Button
            type="button"
            onClick={saveHueToDatabase}
            disabled={saving}
            className="bg-primary text-white hover:bg-primary/90 font-black text-xs h-10 px-6 rounded-xl shadow-md transition"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : null}
            <span>💾 حفظ تدرج ألوان القائمة في قاعدة البيانات</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
