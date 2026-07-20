-- Approval Workflows v2: full replacement of the old approval-routing system
-- (HrApprovalChain + WorkflowPathTemplate + HierarchyStore department/branch/
-- project manager maps) with an unlimited Company -> EntityType -> EntityName
-- -> RequestType -> manual-stage-list model, plus an independent
-- SupervisorAssignment registry.

-- 1) Clear pending requests per explicit instruction: any WorkflowInstance
--    still awaiting a decision, and the underlying request record it tracks
--    (completed/rejected/returned history is left untouched).
DELETE FROM "WorkflowStep" WHERE "workflowInstanceId" IN (SELECT "id" FROM "WorkflowInstance" WHERE "status" = 'PENDING');
DELETE FROM "LeaveRequest" WHERE "status" = 'PENDING';
DELETE FROM "OvertimeRequest" WHERE "status" = 'PENDING';
DELETE FROM "LetterRequest" WHERE "status" = 'PENDING';
DELETE FROM "ExpenseRequest" WHERE "status" = 'PENDING';
DELETE FROM "ResumptionRequest" WHERE "status" = 'PENDING';
DELETE FROM "WorkflowInstance" WHERE "status" = 'PENDING';

-- 2) Drop the old approval-routing tables entirely.
DROP TABLE IF EXISTS "WorkflowPathTemplate";
DROP TYPE IF EXISTS "WorkflowPathType";
DROP TABLE IF EXISTS "HrApprovalChain";

-- 3) New entity-type enum shared by ApprovalPath and SupervisorAssignment.
DO $$ BEGIN
  CREATE TYPE "ApprovalEntityType" AS ENUM ('HOSPITAL', 'DEPARTMENT', 'BRANCH', 'PROJECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4) Company (new first-class org root -- multi-company ready).
CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Company_code_key" ON "Company"("code");
CREATE INDEX IF NOT EXISTS "Company_isActive_idx" ON "Company"("isActive");

-- 5) Project (fourth org-unit type -- previously only an unstructured JSON map).
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Project_code_key" ON "Project"("code");
CREATE INDEX IF NOT EXISTS "Project_isActive_idx" ON "Project"("isActive");

-- 6) ApprovalPath: one row per (company, entityType, entityId, requestType).
CREATE TABLE IF NOT EXISTS "ApprovalPath" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalPath_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalPath_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalPath_companyId_entityType_entityId_requestType_key" ON "ApprovalPath"("companyId", "entityType", "entityId", "requestType");
CREATE INDEX IF NOT EXISTS "ApprovalPath_entityType_entityId_idx" ON "ApprovalPath"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ApprovalPath_requestType_idx" ON "ApprovalPath"("requestType");
CREATE INDEX IF NOT EXISTS "ApprovalPath_isActive_idx" ON "ApprovalPath"("isActive");

-- 7) ApprovalStage: unlimited manually-ordered stages per path.
CREATE TABLE IF NOT EXISTS "ApprovalStage" (
  "id" TEXT NOT NULL,
  "approvalPathId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "name" TEXT,
  "approverEmployeeId" TEXT NOT NULL,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalStage_approvalPathId_fkey" FOREIGN KEY ("approvalPathId") REFERENCES "ApprovalPath"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ApprovalStage_approverEmployeeId_fkey" FOREIGN KEY ("approverEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStage_approvalPathId_order_key" ON "ApprovalStage"("approvalPathId", "order");
CREATE INDEX IF NOT EXISTS "ApprovalStage_approvalPathId_idx" ON "ApprovalStage"("approvalPathId");
CREATE INDEX IF NOT EXISTS "ApprovalStage_approverEmployeeId_idx" ON "ApprovalStage"("approverEmployeeId");

-- 8) SupervisorAssignment: independent registry driving both approval-path
--    authoring convenience and live employee-visibility scoping.
CREATE TABLE IF NOT EXISTS "SupervisorAssignment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupervisorAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupervisorAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SupervisorAssignment_employeeId_idx" ON "SupervisorAssignment"("employeeId");
CREATE INDEX IF NOT EXISTS "SupervisorAssignment_entityType_entityId_idx" ON "SupervisorAssignment"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SupervisorAssignment_isActive_idx" ON "SupervisorAssignment"("isActive");

-- 9) Employee gains optional company/project membership.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Employee_companyId_idx" ON "Employee"("companyId");
CREATE INDEX IF NOT EXISTS "Employee_projectId_idx" ON "Employee"("projectId");
DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 10) Seed a single default Company so existing data has somewhere to land
--     and the new Approval Workflows page has at least one company to pick
--     from immediately; admins can rename it or add more from the UI.
INSERT INTO "Company" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
VALUES ('default-company', 'الشركة الرئيسية', 'MAIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
