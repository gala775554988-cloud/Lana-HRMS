'use client';

import { useEffect } from 'react';
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
  const mode = useThemeStore((state) => state.mode);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(mode);

    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        const sysResolved = mediaQuery.matches ? 'dark' : 'light';
        if (sysResolved === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
          root.style.colorScheme = 'light';
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [mode]);

  return <>{children}</>;
}
