'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, ThemeName } from '@/lib/design-system/tokens';

interface ThemeState {
  mode: ThemeMode;
  themeName: ThemeName;
  sidebarCollapsed: boolean;
  setMode: (mode: ThemeMode) => void;
  setThemeName: (name: ThemeName) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      themeName: 'default',
      sidebarCollapsed: false,
      setMode: (mode) => set({ mode }),
      setThemeName: (themeName) => set({ themeName }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'lana-hrms-theme', partialize: (state) => ({ mode: state.mode, themeName: state.themeName, sidebarCollapsed: state.sidebarCollapsed }) }
  )
);
