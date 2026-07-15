-- HrPermissionScope, HrApprovalChain, and HrPermissionAudit existed in
-- schema.prisma but were never captured in a migration file -- found via
-- prisma migrate diff against a fully-migrated fresh database, same class
-- of bug as the earlier missing Employee.sponsor and PermissionGroup
-- migrations. HrApprovalChain specifically is read directly by the
-- permissions "scopes" tab (app/(hrms)/permissions/page.tsx), so its
-- absence was a real, reproducible runtime error, not just latent drift.

CREATE TABLE IF NOT EXISTS "HrPermissionScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "branchId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPermissionScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrApprovalChain" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "approverRole" TEXT NOT NULL DEFAULT 'DIRECT_MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrApprovalChain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrPermissionAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "byUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPermissionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HrPermissionScope_userId_idx" ON "HrPermissionScope"("userId");
CREATE INDEX IF NOT EXISTS "HrPermissionScope_module_idx" ON "HrPermissionScope"("module");
CREATE UNIQUE INDEX IF NOT EXISTS "HrPermissionScope_userId_module_key" ON "HrPermissionScope"("userId", "module");

CREATE INDEX IF NOT EXISTS "HrApprovalChain_module_idx" ON "HrApprovalChain"("module");
CREATE UNIQUE INDEX IF NOT EXISTS "HrApprovalChain_module_level_key" ON "HrApprovalChain"("module", "level");

CREATE INDEX IF NOT EXISTS "HrPermissionAudit_userId_idx" ON "HrPermissionAudit"("userId");
CREATE INDEX IF NOT EXISTS "HrPermissionAudit_createdAt_idx" ON "HrPermissionAudit"("createdAt");
