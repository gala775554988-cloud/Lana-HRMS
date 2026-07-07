# Changelog

## 0.2.0 - UI/UX Redesign & Command Palette Enhancement (2026-07-07)

- **Command Palette (Quick Search Modal)**: Added `QuickSearchModal` (`⌘K` / `Ctrl+K`) for instant search and navigation across all HR modules, quick actions (Create Leave Request, Submit Expense, Run Payroll), and Lana AI analytics.
- **Enterprise Executive Dashboard Redesign**: Restyled `/dashboard` with dynamic gradients, bilingual KPI cards, real-time live badges, and fully responsive grid layouts.
- **Full Dark Mode Polish**: Updated `globals.css`, `app-shell.tsx`, and Recharts components (`dashboard-charts.tsx`) to eliminate hardcoded light colors, providing seamless dark mode transitions, custom tooltips, and high-contrast accessibility.
- **Enhanced App Shell Navigation**: Refined sidebar and header with glassmorphism, mobile slide-over drawer with backdrop blur, active link highlights, and an embedded Lana AI status widget.

## 0.1.0 - Enterprise HRMS Readiness

- Added full HRMS domain coverage for employees, organization data, attendance, leave, payroll, recruitment, training, performance, assets, documents, contracts, reports, notifications, settings, and audit logs.
- Added Auth.js authentication, JWT sessions, RBAC permissions, protected routes, and audit logging.
- Added enterprise dashboard KPIs, charts, module tables, search, filters, pagination, loading states, empty states, and error screens.
- Added production deployment assets for Vercel, Supabase, Docker, and GitHub Actions.
- Added verification script for required modules, models, permissions, and deployment documentation.
