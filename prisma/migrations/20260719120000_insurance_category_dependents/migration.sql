-- Adds the insurance policy category (VIP/A/B/C/NA) and number-of-dependents
-- fields requested for the insurance module.
ALTER TABLE "InsurancePolicy" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'NA';
ALTER TABLE "InsurancePolicy" ADD COLUMN IF NOT EXISTS "dependentsCount" INTEGER NOT NULL DEFAULT 0;
