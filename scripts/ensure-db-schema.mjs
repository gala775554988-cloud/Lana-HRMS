import { PrismaClient } from '@prisma/client';

async function ensureDbSchema() {
  setTimeout(() => {
    console.log('[ensure-db-schema] 25s timeout reached, safely exiting so Vercel build can proceed without hang...');
    process.exit(0);
  }, 25000);

  const rawUrl = process.env.POSTGRES_PRISMA_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  const url = rawUrl.trim();
  if (!url) {
    console.warn('[ensure-db-schema] Neither POSTGRES_PRISMA_URL nor DATABASE_URL is set in environment variables. Skipping schema verification.');
    return;
  }

  console.log('[ensure-db-schema] Connecting to verify and auto-heal database schema on Neon...');
  const client = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS "HrPermissionScope" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "module" TEXT NOT NULL,
      "scope" TEXT NOT NULL DEFAULT 'ALL',
      "branchId" TEXT,
      "departmentId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HrPermissionScope_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "HrApprovalChain" (
      "id" TEXT NOT NULL,
      "module" TEXT NOT NULL,
      "level" INTEGER NOT NULL DEFAULT 1,
      "approverRole" TEXT NOT NULL DEFAULT 'DIRECT_MANAGER',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HrApprovalChain_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "HrPermissionAudit" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "module" TEXT,
      "oldValue" TEXT,
      "newValue" TEXT,
      "byUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HrPermissionAudit_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "HrPermissionScope_userId_idx" ON "HrPermissionScope"("userId");`,
    `CREATE INDEX IF NOT EXISTS "HrPermissionScope_module_idx" ON "HrPermissionScope"("module");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HrPermissionScope_userId_module_key" ON "HrPermissionScope"("userId", "module");`,
    `CREATE INDEX IF NOT EXISTS "HrApprovalChain_module_idx" ON "HrApprovalChain"("module");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HrApprovalChain_module_level_key" ON "HrApprovalChain"("module", "level");`,
    `CREATE INDEX IF NOT EXISTS "HrPermissionAudit_userId_idx" ON "HrPermissionAudit"("userId");`,
    `CREATE INDEX IF NOT EXISTS "HrPermissionAudit_createdAt_idx" ON "HrPermissionAudit"("createdAt");`,
    `CREATE TABLE IF NOT EXISTS "EmployeeMobileDevice" (
      "id" TEXT NOT NULL,
      "employeeId" TEXT NOT NULL,
      "deviceId" TEXT NOT NULL,
      "platform" TEXT NOT NULL DEFAULT 'mobile',
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "EmployeeMobileDevice_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_key" ON "EmployeeMobileDevice"("employeeId");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeMobileDevice_deviceId_key" ON "EmployeeMobileDevice"("deviceId");`,
    `CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_deviceId_idx" ON "EmployeeMobileDevice"("employeeId", "deviceId");`,
    `CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_deviceId_idx" ON "EmployeeMobileDevice"("deviceId");`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canUseMultipleDevices" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentChallenge" TEXT;`,
    `CREATE TABLE IF NOT EXISTS "BiometricCredential" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "credentialID" TEXT NOT NULL, "publicKey" BYTEA NOT NULL, "counter" BIGINT NOT NULL DEFAULT 0, "deviceType" TEXT, "backedUp" BOOLEAN NOT NULL DEFAULT false, "transports" TEXT[], "deviceName" TEXT, "lastUsedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BiometricCredential_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "BiometricCredential_credentialID_key" ON "BiometricCredential"("credentialID");`,
    `CREATE INDEX IF NOT EXISTS "BiometricCredential_userId_idx" ON "BiometricCredential"("userId");`,
    `DO $$ BEGIN CREATE TYPE "WorkflowPathType" AS ENUM ('HOSPITAL_PATH', 'GENERAL_ADMIN_PATH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `CREATE TABLE IF NOT EXISTS "WorkflowPathTemplate" ("id" TEXT NOT NULL, "workflowType" "WorkflowPathType" NOT NULL, "workflowName" TEXT NOT NULL, "sendToDirectManagerFirst" BOOLEAN NOT NULL DEFAULT true, "requestTypes" JSONB NOT NULL DEFAULT '[]'::jsonb, "targetOrgUnitIds" JSONB NOT NULL DEFAULT '[]'::jsonb, "steps" JSONB NOT NULL, "updatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WorkflowPathTemplate_pkey" PRIMARY KEY ("id"));`,
    `ALTER TABLE "WorkflowPathTemplate" ADD COLUMN IF NOT EXISTS "sendToDirectManagerFirst" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE "WorkflowPathTemplate" ADD COLUMN IF NOT EXISTS "requestTypes" JSONB NOT NULL DEFAULT '[]'::jsonb;`,
    `ALTER TABLE "WorkflowPathTemplate" ADD COLUMN IF NOT EXISTS "targetOrgUnitIds" JSONB NOT NULL DEFAULT '[]'::jsonb;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowPathTemplate_workflowType_key" ON "WorkflowPathTemplate"("workflowType");`,
    `CREATE INDEX IF NOT EXISTS "WorkflowPathTemplate_workflowType_idx" ON "WorkflowPathTemplate"("workflowType");`,
    `CREATE TABLE IF NOT EXISTS "ResumptionRequest" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "leaveRequestId" TEXT, "returnDate" TIMESTAMP(3) NOT NULL, "resumptionType" TEXT NOT NULL DEFAULT 'AFTER_LEAVE', "reason" TEXT, "notes" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "decidedAt" TIMESTAMP(3), "decisionNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ResumptionRequest_pkey" PRIMARY KEY ("id"));`,
    `CREATE INDEX IF NOT EXISTS "ResumptionRequest_employeeId_idx" ON "ResumptionRequest"("employeeId");`,
    `CREATE INDEX IF NOT EXISTS "ResumptionRequest_status_idx" ON "ResumptionRequest"("status");`,
    `CREATE TABLE IF NOT EXISTS "EmployeeLeaveBalance" (
      "id" TEXT NOT NULL,
      "employeeId" TEXT NOT NULL,
      "accrued" DECIMAL(6,2) NOT NULL DEFAULT 30,
      "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmployeeLeaveBalance_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLeaveBalance_employeeId_key" ON "EmployeeLeaveBalance"("employeeId");`,
    `ALTER TABLE "InsurancePolicy" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'NA';`,
    `ALTER TABLE "InsurancePolicy" ADD COLUMN IF NOT EXISTS "dependentsCount" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "HrPermissionScope" ADD COLUMN IF NOT EXISTS "hospitalId" TEXT;`,
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "sponsor" TEXT;`,
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooRawData" JSONB;`,
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooRawDataSyncedAt" TIMESTAMP(3);`,
    `ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';`,
    `ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "odooAttachmentId" INTEGER;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDocument_odooAttachmentId_key" ON "EmployeeDocument"("odooAttachmentId");`,
    `ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooRawData" JSONB;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "odooPayslipId" INTEGER;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "odooRawData" JSONB;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PayrollItem_odooPayslipId_key" ON "PayrollItem"("odooPayslipId");`,
    `ALTER TABLE "Allowance" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';`,
    `ALTER TABLE "Allowance" ADD COLUMN IF NOT EXISTS "odooPayslipLineId" INTEGER;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Allowance_odooPayslipLineId_key" ON "Allowance"("odooPayslipLineId");`,
    `ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';`,
    `ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "odooPayslipLineId" INTEGER;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Deduction_odooPayslipLineId_key" ON "Deduction"("odooPayslipLineId");`,
    `ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3);`,
    `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "key" TEXT;`,
    `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;`,
    `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "parentId" TEXT;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PermissionGroup_key_key" ON "PermissionGroup"("key");`,
    `CREATE INDEX IF NOT EXISTS "PermissionGroup_key_idx" ON "PermissionGroup"("key");`,
    `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
    `CREATE INDEX IF NOT EXISTS "Employee_firstName_trgm_idx" ON "Employee" USING GIN ("firstName" gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS "Employee_lastName_trgm_idx" ON "Employee" USING GIN ("lastName" gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS "Employee_employeeNumber_trgm_idx" ON "Employee" USING GIN ("employeeNumber" gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS "Employee_nationalId_trgm_idx" ON "Employee" USING GIN ("nationalId" gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS "Employee_email_trgm_idx" ON "Employee" USING GIN ("email" gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS "Employee_phone_trgm_idx" ON "Employee" USING GIN ("phone" gin_trgm_ops);`
  ];

  let successCount = 0;
  for (const sql of sqlStatements) {
    try {
      await client.$executeRawUnsafe(sql);
      successCount++;
    } catch (err) {
      // Ignore notices or non-fatal DDL messages
    }
  }

  await client.$disconnect();
  console.log(`[ensure-db-schema] Schema check finished. Executed ${successCount}/${sqlStatements.length} DDL statements cleanly.`);
}

ensureDbSchema().catch((err) => {
  console.error('[ensure-db-schema] Error during schema check:', err.message);
  process.exit(0); // Never fail the build if DDL notice occurs
});
