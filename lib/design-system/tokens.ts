/**
 * Lana HRMS Design System Tokens
 * Comprehensive, themeable design system inspired by BambooHR, HiBob, Personio
 */

export const colors = {
  brand: {
    50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
    400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
    800: '#3730A3', 900: '#312E81', 950: '#1E1B4B',
  },
  status: {
    active: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
    onLeave: { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', dot: '#F97316' },
    inactive: { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB', dot: '#9CA3AF' },
    suspended: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  },
  semantic: { success: '#10B981', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6' },
  surface: {
    light: { primary: '#FFFFFF', secondary: '#F8FAFC', tertiary: '#F1F5F9', elevated: '#FFFFFF' },
    dark: { primary: '#0F172A', secondary: '#1E293B', tertiary: '#334155', elevated: '#1E293B' },
  },
} as const;

export const typography = {
  fontFamily: { sans: 'Inter, Noto Sans Arabic, system-ui, sans-serif', mono: 'JetBrains Mono, ui-monospace, monospace' },
  fontSizes: {
    xs: ['0.75rem', { lineHeight: '1rem' }], sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }], lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }], '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  fontWeights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export const spacing = {
  0: '0px', 0.5: '2px', 1: '4px', 1.5: '6px', 2: '8px', 2.5: '10px',
  3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px',
  12: '48px', 16: '64px', 20: '80px', 24: '96px',
} as const;

export const borderRadius = {
  none: '0px', sm: '6px', md: '8px', lg: '12px', xl: '16px',
  '2xl': '20px', '3xl': '24px', full: '9999px',
} as const;

export const shadows = {
  none: 'none', xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
  cardHover: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
  drawer: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const breakpoints = {
  mobile: '640px', tablet: '768px', laptop: '1024px', desktop: '1280px', wide: '1536px',
} as const;

export const zIndex = {
  base: 0, dropdown: 10, sticky: 20, overlay: 30, drawer: 40, modal: 50, popover: 60, toast: 70, tooltip: 80,
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeName = 'default' | 'corporate' | 'modern';

export interface ThemeConfig {
  name: ThemeName; label: string; mode: ThemeMode;
  colors: typeof colors; borderRadius: typeof borderRadius; shadows: typeof shadows;
}

export const defaultTheme: ThemeConfig = {
  name: 'default', label: 'Lana Default', mode: 'system', colors, borderRadius, shadows,
};

export const themes: Record<ThemeName, ThemeConfig> = {
  default: defaultTheme,
  corporate: { name: 'corporate', label: 'Corporate', mode: 'system', colors, borderRadius, shadows },
  modern: { name: 'modern', label: 'Modern', mode: 'system', colors, borderRadius, shadows },
};

export const employeeStatusConfig = {
  ACTIVE: { label: { en: 'Active', ar: 'نشط' }, color: colors.status.active },
  ON_LEAVE: { label: { en: 'On Leave', ar: 'في إجازة' }, color: colors.status.onLeave },
  INACTIVE: { label: { en: 'Inactive', ar: 'غير نشط' }, color: colors.status.inactive },
  TERMINATED: { label: { en: 'Suspended', ar: 'موقوف' }, color: colors.status.suspended },
} as const;

export type EmployeeStatus = keyof typeof employeeStatusConfig;
