-- Social Insurance (GOSI-style) module: one live registration record per
-- employee, plus an append-only movement ledger. No update/delete path is
-- ever exposed for SocialInsuranceMovement -- it is written only via
-- lib/enterprise/social-insurance.ts's recordMovement(), same discipline as
-- AuditLog.
DO $$ BEGIN
  CREATE TYPE "SocialInsuranceStatus" AS ENUM ('NOT_REGISTERED', 'ACTIVE', 'SUSPENDED', 'EXCLUDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SocialInsuranceMovementType" AS ENUM ('REGISTERED', 'WAGE_ADJUSTED', 'SUSPENDED', 'REACTIVATED', 'EXCLUDED', 'RATE_CHANGED', 'DOCUMENT_ADDED', 'NOTE_ADDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SocialInsuranceMovementSource" AS ENUM ('MANUAL', 'PAYROLL_SYNC', 'CONTRACT_SYNC', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SocialInsuranceRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "SocialInsuranceStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "subscriberNumber" TEXT,
    "registrationDate" TIMESTAMP(3),
    "exclusionDate" TIMESTAMP(3),
    "exclusionReason" TEXT,
    "subjectWage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "employeeContributionRate" DECIMAL(5,2) NOT NULL DEFAULT 9.00,
    "employerContributionRate" DECIMAL(5,2) NOT NULL DEFAULT 11.75,
    "employeeContributionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employerContributionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialInsuranceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialInsuranceRecord_employeeId_key" ON "SocialInsuranceRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "SocialInsuranceRecord_status_idx" ON "SocialInsuranceRecord"("status");

DO $$ BEGIN
  ALTER TABLE "SocialInsuranceRecord" ADD CONSTRAINT "SocialInsuranceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SocialInsuranceMovement" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "SocialInsuranceMovementType" NOT NULL,
    "description" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "source" "SocialInsuranceMovementSource" NOT NULL DEFAULT 'MANUAL',
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialInsuranceMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SocialInsuranceMovement_recordId_idx" ON "SocialInsuranceMovement"("recordId");
CREATE INDEX IF NOT EXISTS "SocialInsuranceMovement_employeeId_idx" ON "SocialInsuranceMovement"("employeeId");
CREATE INDEX IF NOT EXISTS "SocialInsuranceMovement_createdAt_idx" ON "SocialInsuranceMovement"("createdAt");

DO $$ BEGIN
  ALTER TABLE "SocialInsuranceMovement" ADD CONSTRAINT "SocialInsuranceMovement_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SocialInsuranceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
