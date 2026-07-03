# Deployment

## Vercel

1. Create a Vercel project from the GitHub repository.
2. Configure environment variables from `.env.example`.
3. Use `DATABASE_URL` for the pooled Supabase connection string.
4. Use `DIRECT_URL` for the direct Supabase connection string.
5. Build command: `npx prisma generate && next build`.
6. Install command: `npm install`.

## Supabase

1. Create a Supabase project.
2. Copy the pooled connection string into `DATABASE_URL`.
3. Copy the direct connection string into `DIRECT_URL`.
4. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
5. Run `npx prisma migrate deploy` from CI or a trusted local shell.
6. Run `npx prisma db seed` once to create roles, permissions, and initial reference data.

## GitHub Actions

The workflow in `.github/workflows/ci.yml` installs dependencies, generates Prisma client, runs migrations against a CI PostgreSQL service, lints, and builds.

## External Blockers

If migrations or seeds fail locally, verify that PostgreSQL/Supabase is reachable from the execution environment and that credentials are correct.