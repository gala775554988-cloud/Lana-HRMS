# Deployment Guide

## 1. Environment Variables

Configure these variables in Vercel and local deployment shells:

- `DATABASE_URL`: Supabase pooled PostgreSQL URL for runtime connections.
- `DIRECT_URL`: Supabase direct PostgreSQL URL for migrations.
- `AUTH_SECRET`: secure Auth.js secret.
- `NEXTAUTH_SECRET`: same secure secret or a coordinated secret value.
- `NEXTAUTH_URL`: production application URL.
- `APP_URL`: production application URL.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: public Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service key.

## 2. Supabase

1. Create the Supabase project.
2. Copy pooled and direct connection strings.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma db seed`.
5. Optionally run `prisma/supabase.sql` for storage helpers.

## 3. Vercel

1. Import the GitHub repository.
2. Set the build command to `npx prisma generate && next build`.
3. Set the install command to `npm install`.
4. Configure all environment variables.
5. Deploy.

## 4. GitHub Actions

The CI workflow validates dependency installation, Prisma generation, migrations against a CI PostgreSQL service, lint, and production build.

## 5. Docker

Use `docker-compose.yml` for local app and PostgreSQL orchestration, or build the standalone Dockerfile for container deployment.