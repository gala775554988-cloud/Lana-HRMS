"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/design-system/tokens";

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "فاتح", icon: Sun },
  { mode: "dark", label: "داكن", icon: Moon },
  { mode: "system", label: "حسب النظام", icon: Monitor }
];

/** Explicit dark-mode toggle in /settings (in addition to the header's
 * ThemeToggle icon) -- light stays the default look for new sessions
 * (see store/theme.ts), users opt into dark here. */
export function ThemeModeCard() {
  const { mode, setMode } = useThemeStore();

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="text-base">المظهر</CardTitle>
        <CardDescription>الوضع الفاتح هو التنسيق الافتراضي للنظام، ويمكنك التبديل للوضع الداكن هنا في أي وقت.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMode(option.mode)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-bold transition-all",
                  active
                    ? "border-primary bg-primary/8 text-primary shadow-sm"
                    : "border-slate-200 text-slate-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-800 dark:text-slate-400"
                )}
                aria-pressed={active}
              >
                <Icon className="h-5 w-5" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
