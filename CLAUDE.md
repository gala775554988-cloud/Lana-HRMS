# CLAUDE.md - Lana HRMS Project Standards

## Project Overview
Lana HRMS is an Enterprise Human Resource Management System built with Next.js 15, Prisma, PostgreSQL, NextAuth v5, Tailwind CSS.

## Architecture

### Directory Structure
```
app/
  (hrms)/          # Protected HRMS routes (role-based)
    [module]/      # Generic CRUD for HR modules
    dashboard/     # Main dashboard
    integrations/  # Odoo & ERP integrations
    employees/     # Custom employee list with tabs (archived, duplicates)
  api/
    hr/[module]/   # Generic HR CRUD APIs
    employees/     # Custom employee APIs (archived, duplicates, last-active)
    integrations/odoo/ # Odoo sync APIs
  components/
    hrms/          # HR-specific components (employee-list, module-table, etc.)
    ui/            # shadcn/ui base components
    integrations/  # Integration components
  lib/
    hrms/          # HR business logic (actions.ts)
    integrations/odoo/ # Odoo client, mapper, sync
    prisma.ts      # Prisma client with connection_limit=5
    rbac.ts        # Role-based access control
  prisma/
    schema.prisma  # Database schema (50+ models)
    migrations/    # SQL migrations
  config/
    hrms.ts        # HR modules definition (30+ modules)
```

### Code Style

#### TypeScript
- Strict mode, no `any` unless necessary
- Use `type` for data shapes, `interface` for props
- Prefer `async/await` over promises
- Use `try/catch` with ContinueOnError for batch operations (never throw inside loop)

#### React
- Server Components by default, Client Components only when needed (`"use client"`)
- Use `useMemo` for expensive calculations (stats, filterFields)
- Use `useCallback` for all handlers to prevent re-renders
- Use `useTransition` for non-urgent updates (search)
- Memoize components with `React.memo` when rendering lists

#### Prisma
- Always use `select` instead of `include` when only few fields needed
- Bulk operations: `findMany({ where: { in: [...] } })` instead of N+1 `findFirst`
- Add indexes for all fields used in `where`, `orderBy`, search
- Use `skip/take` for pagination from DB, never in browser
- Transactions short: `timeout: 15000, maxWait: 5000`

#### API Routes
- `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300` for long syncs
- Always check auth via `requireOdooIntegrationAccess` or `auth()`
- Return standardized `{ success, data, message }`
- Log all operations to `IntegrationLog` and `AuditLog`

#### Styling
- Tailwind CSS with shadcn/ui
- Colors: indigo primary (#4F46E5), slate neutral, amber for warnings, red for errors
- Dark mode ready: use `dark:` variants
- Responsive: Mobile First, grid with `sm:`, `lg:`, `xl:`
- No inline styles, use `cn()` utility

### Design Principles

#### Enterprise & Modern
- Rounded 2xl cards with subtle shadows
- Backdrop blur for depth
- Consistent spacing (space-y-6, gap-4)
- Icons from lucide-react
- Empty states with illustration and action

#### Performance First
- Server-side pagination (never load all 10000 at once)
- Lazy loading for tabs (archived, duplicates only load when active)
- Memoization for stats and filters
- Indexes on all searchable columns
- Bulk operations to avoid N+1

#### Security
- All routes check `requireModulePermission` or `requireOdooIntegrationAccess`
- No public endpoints without secret or auth
- Audit Log for all sensitive operations
- No sensitive data in logs (redact passwords)
- Rate limiting via middleware (to be added)

### Odoo Integration Standards

#### Pagination
- Always `id > lastOdooId` + `order id asc` + `context: {active_test: false}` to include inactive
- Never rely on `offset` only (unstable if data changes)
- Batch size 500 for employees

#### ContinueOnError
```ts
for (const row of rows) {
  try {
    // create/update
  } catch (e) {
    errors.push({ id, message })
    skipped++
    continue // never throw
  }
}
```

#### Resume
- After each batch: `prisma.syncHistory.update({ metadata: { page, lastOdooId, lastWriteDate, imported, updated, skipped } })`
- Resume from `lastOdooId` not offset

#### No Data Modification for Duplicates
- If duplicate found (P2002), log and skip, don't modify original data like `ODOO-${id}` or `email=null`

### Development Priorities

#### P0 - Critical
- Odoo sync must handle 8000+ employees without stopping
- Archived employees tab with lastActiveDate
- Duplicate accounts detection
- Performance <1s for any page

#### P1 - Important
- Full CRUD for all reference data (departments, branches, positions, leave-types, etc.)
- Global Search (Cmd+K)
- Dashboard with real charts
- AI System Manager

#### P2 - Enhancement
- Design System documentation
- Tests (Vitest, Playwright)
- CI/CD (GitHub Actions)
- Monitoring (Sentry)

#### P3 - New Features
- Payroll auto-calculation
- Performance 360
- Recruitment kanban
- Mobile app

### Testing

#### Before Commit
- `npm run build` must pass
- No TypeScript errors
- No console.log in production
- Test with 10000 mock employees

#### Verification
- Odoo count vs DB count
- Search speed <500ms
- No N+1 queries (check Prisma logs)
- No throw inside employee loop

### Deployment

- Vercel with `maxDuration=300` for sync routes
- Prisma `connection_limit=5` to avoid too many connections
- Env vars in Vercel Project Settings (never in code)
- Migrations via `/api/migrate-*` endpoints with secret, then remove

### AI System Manager

- Analyze project, detect empty pages, missing functions, bugs, security, performance, UX, design
- Propose improvements
- Monitor performance and DB
- Generate reports and rating

### Forbidden

- Don't delete working features unless wrong
- Don't break compatibility
- Don't cause new errors
- Don't duplicate code
- Don't use temporary solutions
- Don't add Queue/Redis/BullMQ unless explicitly requested (per current phase, minimal fix only)

### Final Goal

Build a world-class HRMS, fast, secure, scalable, easy to use, with clean, organized, documented code.
