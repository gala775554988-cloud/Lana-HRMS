'use client';

import { useEffect, useMemo } from 'react';
import { useThemeStore } from '@/store/theme';
import type { ThemeMode } from '@/lib/design-system/tokens';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeStore();
  const resolved = useMemo(() => resolveTheme(mode), [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  }, [resolved]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mq.matches ? 'dark' : 'light');
      root.style.colorScheme = mq.matches ? 'dark' : 'light';
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  return <>{children}</>;
}
