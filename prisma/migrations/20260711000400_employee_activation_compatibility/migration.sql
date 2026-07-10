-- Compatibility column expected by employee detail pages in production deployments.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isPendingActivation" BOOLEAN NOT NULL DEFAULT false;
