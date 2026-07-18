-- Insurance Management module: policy records per employee, with a status +
-- endDate composite index backing the "renewal due soon" badge query.
DO $$ BEGIN
  CREATE TYPE "InsuranceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "coverageType" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentUrl" TEXT,
    "documentName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InsurancePolicy_policyNumber_key" ON "InsurancePolicy"("policyNumber");
CREATE INDEX IF NOT EXISTS "InsurancePolicy_employeeId_idx" ON "InsurancePolicy"("employeeId");
CREATE INDEX IF NOT EXISTS "InsurancePolicy_status_endDate_idx" ON "InsurancePolicy"("status", "endDate");

DO $$ BEGIN
  ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
