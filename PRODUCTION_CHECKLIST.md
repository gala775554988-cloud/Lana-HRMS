# Production Checklist

## Verified Locally

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run verify`
- [x] `npx prisma validate`
- [x] `npx prisma generate`
- [x] Next.js dev server reaches ready state
- [x] Root metadata and viewport configured
- [x] Loading, error, empty, and not-found states configured
- [x] RBAC resources and roles configured
- [x] API routes configured
- [x] Upload route configured
- [x] Deployment files configured

## Requires External Infrastructure

- [ ] Reachable Supabase/PostgreSQL database
- [ ] `npx prisma migrate deploy` against production database
- [ ] `npx prisma db seed` against production database
- [ ] GitHub write access for push
- [ ] Vercel project/token for deployment verification

## Launch Gate

Launch is approved after the external infrastructure checks above pass in CI or a trusted deployment environment.