# Test Report

## Automated Checks

- `npm install`: Passed in the current workspace.
- `npm run lint`: Passed with zero reported ESLint errors.
- `npm run build`: Passed with Next.js production compilation, type checking, and route generation.
- `npx prisma generate`: Passed after Prisma config loaded environment variables.
- `npx prisma validate`: Passed.
- `npm run verify`: Validates required module files, Prisma models, and RBAC resources.

## External Infrastructure Checks

- `npx prisma migrate deploy`: Requires reachable PostgreSQL/Supabase. The configured Supabase endpoint was not reachable from this execution environment.
- `npx prisma db seed`: Requires reachable PostgreSQL/Supabase. The seed logic is present and validated, but execution depends on database reachability.

## Manual Coverage Map

- Authentication pages: login, logout, forgot password, reset password, email verification.
- Protected HRMS routes: dashboard, module list pages, record profile pages, reports.
- APIs: Auth.js route, HRMS collection route, HRMS record route, uploads route.
- UI states: loading, error, empty, dark mode, responsive navigation.