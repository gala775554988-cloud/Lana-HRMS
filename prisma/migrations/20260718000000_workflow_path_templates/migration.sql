-- Approval path editor: one configurable named chain per workflow type.
DO $$ BEGIN
  CREATE TYPE "WorkflowPathType" AS ENUM ('HOSPITAL_PATH', 'GENERAL_ADMIN_PATH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorkflowPathTemplate" (
  "id" TEXT NOT NULL,
  "workflowType" "WorkflowPathType" NOT NULL,
  "workflowName" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowPathTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowPathTemplate_workflowType_key" ON "WorkflowPathTemplate"("workflowType");
CREATE INDEX IF NOT EXISTS "WorkflowPathTemplate_workflowType_idx" ON "WorkflowPathTemplate"("workflowType");
