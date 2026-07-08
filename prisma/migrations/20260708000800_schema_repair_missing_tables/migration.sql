-- Schema repair migration for models present in schema.prisma but absent from prior migration SQL.
-- Idempotent so it can safely run after earlier production hotfixes or on fresh databases.

DO $$ BEGIN
  CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "EmployeePreference" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'corporate',
  "language" TEXT NOT NULL DEFAULT 'ar',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  "notifications" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpenseRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "receiptUrl" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LetterRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "letterType" TEXT NOT NULL,
  "purpose" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LetterRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowStep" (
  "id" TEXT NOT NULL,
  "workflowInstanceId" TEXT NOT NULL,
  "step" INTEGER NOT NULL,
  "approverUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "comments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- Re-assert production tables that existed in prior migrations but were missing in the observed database.
CREATE TABLE IF NOT EXISTS "IntegrationSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PlatformHealthMetric" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "service" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OK',
  "traceId" TEXT,
  "metadata" JSONB,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeePreference_employeeId_key" ON "EmployeePreference"("employeeId");
CREATE INDEX IF NOT EXISTS "ExpenseRequest_employeeId_idx" ON "ExpenseRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "ExpenseRequest_status_idx" ON "ExpenseRequest"("status");
CREATE INDEX IF NOT EXISTS "LetterRequest_employeeId_idx" ON "LetterRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "LetterRequest_status_idx" ON "LetterRequest"("status");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_employeeId_idx" ON "WorkflowInstance"("employeeId");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");
CREATE INDEX IF NOT EXISTS "WorkflowStep_workflowInstanceId_idx" ON "WorkflowStep"("workflowInstanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationSetting_providerId_key_key" ON "IntegrationSetting"("providerId", "key");
CREATE INDEX IF NOT EXISTS "IntegrationSetting_key_idx" ON "IntegrationSetting"("key");
CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_service_idx" ON "PlatformHealthMetric"("service");
CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_metric_idx" ON "PlatformHealthMetric"("metric");
CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_status_idx" ON "PlatformHealthMetric"("status");
CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_capturedAt_idx" ON "PlatformHealthMetric"("capturedAt");

DO $$ BEGIN
  ALTER TABLE "EmployeePreference" ADD CONSTRAINT "EmployeePreference_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LetterRequest" ADD CONSTRAINT "LetterRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "IntegrationSetting" ADD CONSTRAINT "IntegrationSetting_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
