"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AuthPreferences() {
  const [dark, setDark] = useState(false);
  const [rtl, setRtl] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const storedDirection = window.localStorage.getItem("direction");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = storedTheme ? storedTheme === "dark" : prefersDark;
    const nextRtl = storedDirection === "rtl";

    setDark(nextDark);
    setRtl(nextRtl);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.dir = nextRtl ? "rtl" : "ltr";
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  function toggleDirection() {
    const next = !rtl;
    setRtl(next);
    document.documentElement.dir = next ? "rtl" : "ltr";
    window.localStorage.setItem("direction", next ? "rtl" : "ltr");
  }

  return (
    <div className="flex items-center gap-2" aria-label="Display preferences">
      <Button type="button" variant="outline" size="sm" onClick={toggleDirection} className="h-9 gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-border dark:bg-background/60 dark:text-foreground">
        <Languages className="h-4 w-4" aria-hidden="true" />
        {rtl ? "RTL" : "LTR"}
      </Button>
      <Button type="button" variant="outline" size="icon" onClick={toggleTheme} className="h-9 w-9 border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-border dark:bg-background/60 dark:text-foreground" aria-label="Toggle dark mode">
        {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </div>
  );
}