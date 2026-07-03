# Security Audit

## Authentication

- Auth.js/NextAuth v5 credentials flow is configured.
- Passwords are hashed with bcryptjs.
- JWT session strategy is enabled.
- Protected HRMS routes require authenticated sessions.
- Middleware reads JWT only and does not import Prisma, preserving edge compatibility.

## Authorization

- RBAC resources cover dashboard, employees, organization data, payroll, attendance, leave, recruitment, performance, training, assets, documents, contracts, reports, notifications, settings, and audit logs.
- Server actions require read/manage permissions before data access or mutation.
- Mutation actions write audit logs.

## Input Validation

- Authentication flows use Zod schemas.
- HRMS module mutations use generated Zod schemas from the module registry.
- API routes pass through server action validation and authorization.

## Headers and Secrets

- Security headers are configured in Next.js and Vercel config.
- Environment variables are documented in `.env.example`.
- Supabase service role key is documented as server-only.

## External Requirements

- Rotate all production secrets before launch.
- Restrict Supabase network/database access according to organization policy.
- Configure production monitoring and alerting for auth failures, permission denials, and upload errors.