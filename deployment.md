# Deployment Guide

## Supabase

Create a Supabase project and copy these values into the deployment environment:

- DATABASE_URL: pooled PostgreSQL connection string for runtime queries
- DIRECT_URL: direct PostgreSQL connection string for migrations
- SUPABASE_URL: project API URL
- SUPABASE_ANON_KEY: public browser key
- SUPABASE_SERVICE_ROLE_KEY: server-only service role key

Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.

## Prisma

Run migrations from CI or a trusted deployment shell:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local development use `npx prisma migrate dev`.

## Vercel

Configure all environment variables in Vercel Project Settings. Use DATABASE_URL with Supabase pooling and DIRECT_URL with the direct connection string. The application uses Node.js server routes for Auth.js, Prisma, uploads, and server actions; middleware remains edge-safe by reading JWT only.

## Docker

Use docker-compose for local PostgreSQL or build the Dockerfile for container deployment.
