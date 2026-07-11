-- Compatibility column expected by deployed employee detail Prisma clients.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "pendingActivationUntil" TIMESTAMP(3);
