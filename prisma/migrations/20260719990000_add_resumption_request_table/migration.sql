-- ResumptionRequest exists in schema.prisma and in scripts/ensure-db-schema.mjs
-- (the actual mechanism that applies DDL in production -- see package.json's
-- vercel-build script, which has no `prisma migrate deploy` step), but was
-- never captured as a migration file. A later migration
-- (20260720000000_approval_workflows_v2) deletes pending rows from this
-- table, so replaying migration history from scratch (as CI's
-- `prisma migrate deploy` against a fresh database does) failed with
-- "relation \"ResumptionRequest\" does not exist". This migration is a no-op
-- everywhere the table already exists (IF NOT EXISTS) and only matters for
-- a from-scratch migration replay.

CREATE TABLE IF NOT EXISTS "ResumptionRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveRequestId" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "resumptionType" TEXT NOT NULL DEFAULT 'AFTER_LEAVE',
    "reason" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResumptionRequest_employeeId_idx" ON "ResumptionRequest"("employeeId");

CREATE INDEX IF NOT EXISTS "ResumptionRequest_status_idx" ON "ResumptionRequest"("status");
