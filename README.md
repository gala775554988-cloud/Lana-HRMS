# HRMS Foundation

A production-oriented Human Resource Management System built with Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn-style UI, Prisma, PostgreSQL, Auth.js/NextAuth v5, Zod, React Hook Form, TanStack Table, Recharts, Zustand, and Framer Motion.

## Modules

- Authentication, JWT sessions, middleware, RBAC, roles, permissions
- Employees, departments, branches, positions, employment types, nationalities
- Documents, contracts, attendance, leave, payroll, loans, overtime
- Allowances, deductions, performance, recruitment, training, assets
- Announcements, dashboard charts, reports, notifications, audit logs, settings

## Local Setup

1. Copy .env.example to .env.
2. Fill DATABASE_URL and DIRECT_URL with PostgreSQL or Supabase values.
3. Set AUTH_SECRET and NEXTAUTH_SECRET to secure random strings.
4. Run npm install.
5. Run npx prisma generate.
6. Run npx prisma migrate dev.
7. Run npm run prisma:seed.
8. Run npm run dev.

## PWA / Mobile App Setup

This project is configured as a Progressive Web App (PWA), so it can be installed on Android, iPhone/iPad, Windows, macOS, and Linux from a browser.

Arabic deployment/install guides are included:

- `VERCEL_SUPABASE_DEPLOY_AR.md` — نشر النظام على Vercel + Supabase.
- `MOBILE_INSTALL_GUIDE.md` — طريقة تثبيت التطبيق على Android و iPhone.

Included PWA files:

- `app/manifest.ts` for install metadata, icons, display mode, and app shortcuts.
- `public/sw.js` service worker for static asset caching and a safe offline fallback.
- `public/offline.html` offline page.
- `public/icons/*` mobile and maskable icons.
- `components/pwa/*` browser-side service-worker registration and install prompt.

Deployment notes:

1. Use HTTPS in production. PWA installation and service workers require HTTPS except on localhost.
2. Set `APP_URL` and `NEXTAUTH_URL` to the real public URL, for example `https://hrms.example.com`.
3. Use Supabase/PostgreSQL values for `DATABASE_URL` and `DIRECT_URL`.
4. Run `npx prisma migrate deploy` on production before starting the app.
5. Build and run with `npm run build` then `npm run start`.
6. On iPhone/iPad, open the site in Safari, tap Share, then Add to Home Screen. On Android/desktop, use the install prompt.

Security note: the service worker does not cache authenticated HTML pages or API responses by default, to avoid storing HR data offline on shared devices.

## Required Environment Variables

See `.env.example` for a copy-pasteable template with placeholder values and inline comments.

**Core (required in every environment):**

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres connection string (Prisma runtime queries). |
| `DIRECT_URL` | Direct (non-pooled) Postgres connection string (Prisma migrations). |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Secure random secrets for NextAuth v5 JWT signing. Set both to the same value. |
| `NEXTAUTH_URL` | Public URL of the deployment, e.g. `https://hrms.example.com`. |
| `APP_URL` | Public URL used for PWA metadata and absolute links. |
| `CRON_SECRET` | Bearer token Vercel Cron sends to authenticate the hourly Odoo sync route (no user session exists for cron runs). |

**Supabase (required if using Supabase for Postgres and/or file storage):**

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key used by `/api/uploads` to store profile photos and documents (employee documents, contracts, insurance policies) in Supabase Storage. Falls back to local filesystem, then inline data URLs, if unset. |
| `SUPABASE_EMPLOYEE_BUCKET` | Optional. Storage bucket name for uploads; defaults to `employee-files`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional. Client-side Supabase key, if client-side Supabase access is added later. |

**Odoo integration (required only if Odoo sync is used):**

| Variable | Purpose |
| --- | --- |
| `ODOO_URL` | Base URL of the Odoo instance. |
| `ODOO_DATABASE` | Odoo database name. |
| `ODOO_USERNAME` | Odoo integration user. |
| `ODOO_PASSWORD` | Odoo integration user's password. |
| `ODOO_API_KEY` | Optional. Preferred over `ODOO_PASSWORD` in production when set. |
| `ODOO_PROTOCOL` | Optional. `auto` (default), `json-rpc`, or `xml-rpc`. |

**Lana AI (required only if the AI Assistant / AI System Manager is enabled):**

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | API key for the Lana AI chat/copilot routes. |
| `OPENAI_MODEL` | Optional. Overrides the default model. |

**Biometric / attendance bridge integrations (optional, only if those devices are deployed):**

`BIOTIME_URL`, `BIOTIME_USERNAME`, `BIOTIME_PASSWORD`, `ZKTECO_IP`, `ZKTECO_PORT`, `ZKTECO_DEVICE_NAME`, `ATTENDANCE_BRIDGE_TOKEN`, `INTEGRATION_SECRET`, `INTERNAL_SYNC_TOKEN`.

**Push notifications (optional):**

`FCM_SERVER_KEY`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, `NEXT_PUBLIC_WEB_PUSH_VAPID_KEY`.

**Seed data (optional, local/dev only):**

`SEED_ADMIN_EMAIL` — overrides the default seeded admin email (`admin@lana.local`).

## Production Checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` before deployment. Run `npm run test:smoke` against a running instance to cover login/logout, per-role dashboard load, a full HR module CRUD cycle, and the Odoo sync auth boundary (see `tests/smoke/`).
