CREATE TABLE IF NOT EXISTS "EnterpriseRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "suite" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "ownerEmployeeId" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("suite", "feature", "code")
);
CREATE TABLE IF NOT EXISTS "EnterpriseWorkflowTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "suite" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "conditions" JSONB,
  "slaHours" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EnterpriseRecord_suite_idx" ON "EnterpriseRecord"("suite");
CREATE INDEX IF NOT EXISTS "EnterpriseRecord_feature_idx" ON "EnterpriseRecord"("feature");
CREATE INDEX IF NOT EXISTS "EnterpriseRecord_status_idx" ON "EnterpriseRecord"("status");
CREATE INDEX IF NOT EXISTS "EnterpriseRecord_ownerEmployeeId_idx" ON "EnterpriseRecord"("ownerEmployeeId");
CREATE INDEX IF NOT EXISTS "EnterpriseWorkflowTemplate_suite_feature_idx" ON "EnterpriseWorkflowTemplate"("suite", "feature");
CREATE INDEX IF NOT EXISTS "EnterpriseWorkflowTemplate_isActive_idx" ON "EnterpriseWorkflowTemplate"("isActive");
