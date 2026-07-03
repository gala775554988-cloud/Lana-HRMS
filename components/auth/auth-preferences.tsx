"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

export function AuthPreferences({ locale }: { locale: Locale }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = storedTheme ? storedTheme === "dark" : prefersDark;

    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <div className="flex items-center gap-2" aria-label="Display preferences">
      <LanguageSwitcher locale={locale} className="h-9 border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-border dark:bg-background/60 dark:text-foreground" />
      <Button type="button" variant="outline" size="icon" onClick={toggleTheme} className="h-9 w-9 border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-border dark:bg-background/60 dark:text-foreground" aria-label="Toggle dark mode">
        {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </div>
  );
}
