"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/lib/design-system/tokens";

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore();

  const cycleMode = () => {
    const modes: ThemeMode[] = ["light", "dark", "system"];
    const currentIndex = modes.indexOf(mode);
    setMode(modes[(currentIndex + 1) % modes.length]);
  };

  const iconMap: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
  const labelMap: Record<ThemeMode, string> = { light: "Light mode", dark: "Dark mode", system: "System mode" };
  const Icon = iconMap[mode];

  return (
    <Button variant="ghost" size="icon" onClick={cycleMode} aria-label={labelMap[mode]} title={labelMap[mode]}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
