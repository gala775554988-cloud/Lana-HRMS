-- Named approvers, branch/hospital scoping, and view/approve/reject
-- capabilities for HrApprovalChain, plus a matching capability snapshot on
-- WorkflowStep. Idempotent (IF NOT EXISTS) since prior migrations in this
-- project have occasionally been re-applied against a DB that already has
-- the columns from a manual fix.

ALTER TABLE "HrApprovalChain"
  ADD COLUMN IF NOT EXISTS "approverUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS "scopeId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "capabilities" TEXT[] DEFAULT ARRAY['VIEW', 'APPROVE', 'REJECT']::TEXT[];

DROP INDEX IF EXISTS "HrApprovalChain_module_level_key";

CREATE UNIQUE INDEX IF NOT EXISTS "HrApprovalChain_module_level_scopeType_scopeId_key"
  ON "HrApprovalChain"("module", "level", "scopeType", "scopeId");

CREATE INDEX IF NOT EXISTS "HrApprovalChain_approverUserId_idx" ON "HrApprovalChain"("approverUserId");

ALTER TABLE "WorkflowStep"
  ADD COLUMN IF NOT EXISTS "capabilities" TEXT[] DEFAULT ARRAY['APPROVE', 'REJECT']::TEXT[];
