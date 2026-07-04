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

## Required Environment Variables

DATABASE_URL, DIRECT_URL, AUTH_SECRET, NEXTAUTH_URL, NEXTAUTH_SECRET, APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

## Production Checks

Run npm run lint and npm run build before deployment.
Test commit from Arena Agent
