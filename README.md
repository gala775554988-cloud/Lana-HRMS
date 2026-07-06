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

DATABASE_URL, DIRECT_URL, AUTH_SECRET, NEXTAUTH_URL, NEXTAUTH_SECRET, APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

## Production Checks

Run npm run lint and npm run build before deployment.
Test commit from Arena Agent
