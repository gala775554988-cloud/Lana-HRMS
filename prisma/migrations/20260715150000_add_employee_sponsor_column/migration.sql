-- Employee.sponsor was added to prisma/schema.prisma but never captured in a
-- migration, so a fresh `prisma migrate deploy` would leave it missing and
-- any read/write touching it (Odoo sync, employee detail pages) would 500.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "sponsor" TEXT;
