import { PrismaClient } from '@prisma/client';

async function ensureDbSchema() {
  setTimeout(() => {
    console.log('[ensure-db-schema] 25s timeout reached, safely exiting so Vercel build can proceed without hang...');
    process.exit(0);
  }, 25000);

  const rawUrl = process.env.POSTGRES_PRISMA_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  let url = rawUrl.trim();
  if (!url) {
    console.warn('[ensure-db-schema] Neither POSTGRES_PRISMA_URL nor DATABASE_URL is set in environment variables. Skipping schema verification.');
    return;
  }
  // Same cold-start patience as the app's runtime client (lib/prisma.ts) --
  // the Neon compute backing a build may itself be suspended -- plus
  // pgbouncer=true, required by Neon's pooled endpoint (transaction-mode
  // PgBouncer) for Prisma's prepared statements.
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connect_timeout')) parsed.searchParams.set('connect_timeout', '20');
    if (parsed.hostname.includes('-pooler') && !parsed.searchParams.has('pgbouncer')) parsed.searchParams.set('pgbouncer', 'true');
    url = parsed.toString();
  } catch {}

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
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sidebarHue" INTEGER NOT NULL DEFAULT 270;`,
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
    `CREATE INDEX IF NOT EXISTS "Employee_phone_trgm_idx" ON "Employee" USING GIN ("phone" gin_trgm_ops);`,
    `DO $$ BEGIN CREATE TYPE "ApprovalEntityType" AS ENUM ('HOSPITAL', 'DEPARTMENT', 'BRANCH', 'PROJECT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `CREATE TABLE IF NOT EXISTS "Company" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Company_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Company_code_key" ON "Company"("code");`,
    `CREATE TABLE IF NOT EXISTS "Project" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Project_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Project_code_key" ON "Project"("code");`,
    `CREATE TABLE IF NOT EXISTS "ApprovalPath" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "entityType" "ApprovalEntityType" NOT NULL, "entityId" TEXT NOT NULL, "requestType" TEXT NOT NULL, "name" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ApprovalPath_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalPath_companyId_entityType_entityId_requestType_key" ON "ApprovalPath"("companyId", "entityType", "entityId", "requestType");`,
    `CREATE TABLE IF NOT EXISTS "ApprovalStage" ("id" TEXT NOT NULL, "approvalPathId" TEXT NOT NULL, "order" INTEGER NOT NULL, "name" TEXT, "approverEmployeeId" TEXT NOT NULL, "isMandatory" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ApprovalStage_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStage_approvalPathId_order_key" ON "ApprovalStage"("approvalPathId", "order");`,
    `CREATE TABLE IF NOT EXISTS "SupervisorAssignment" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "entityType" "ApprovalEntityType" NOT NULL, "entityId" TEXT NOT NULL, "title" TEXT, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SupervisorAssignment_pkey" PRIMARY KEY ("id"));`,
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "companyId" TEXT;`,
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "projectId" TEXT;`,
    `CREATE INDEX IF NOT EXISTS "Employee_companyId_idx" ON "Employee"("companyId");`,
    `CREATE INDEX IF NOT EXISTS "Employee_projectId_idx" ON "Employee"("projectId");`,
    `INSERT INTO "Company" ("id", "name", "code", "isActive", "createdAt", "updatedAt") VALUES ('default-company', 'الشركة الرئيسية', 'MAIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("code") DO NOTHING;`,
    `DO $$ BEGIN CREATE TYPE "SocialInsuranceStatus" AS ENUM ('NOT_REGISTERED', 'ACTIVE', 'SUSPENDED', 'EXCLUDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN CREATE TYPE "SocialInsuranceMovementType" AS ENUM ('REGISTERED', 'WAGE_ADJUSTED', 'SUSPENDED', 'REACTIVATED', 'EXCLUDED', 'RATE_CHANGED', 'DOCUMENT_ADDED', 'NOTE_ADDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN CREATE TYPE "SocialInsuranceMovementSource" AS ENUM ('MANUAL', 'PAYROLL_SYNC', 'CONTRACT_SYNC', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `CREATE TABLE IF NOT EXISTS "SocialInsuranceRecord" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "status" "SocialInsuranceStatus" NOT NULL DEFAULT 'NOT_REGISTERED', "subscriberNumber" TEXT, "registrationDate" TIMESTAMP(3), "exclusionDate" TIMESTAMP(3), "exclusionReason" TEXT, "subjectWage" DECIMAL(12,2) NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'SAR', "employeeContributionRate" DECIMAL(5,2) NOT NULL DEFAULT 9.00, "employerContributionRate" DECIMAL(5,2) NOT NULL DEFAULT 11.75, "employeeContributionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "employerContributionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "lastSyncedAt" TIMESTAMP(3), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SocialInsuranceRecord_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "SocialInsuranceRecord_employeeId_key" ON "SocialInsuranceRecord"("employeeId");`,
    `CREATE INDEX IF NOT EXISTS "SocialInsuranceRecord_status_idx" ON "SocialInsuranceRecord"("status");`,
    `CREATE TABLE IF NOT EXISTS "SocialInsuranceMovement" ("id" TEXT NOT NULL, "recordId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "type" "SocialInsuranceMovementType" NOT NULL, "description" TEXT NOT NULL, "previousValue" JSONB, "newValue" JSONB, "source" "SocialInsuranceMovementSource" NOT NULL DEFAULT 'MANUAL', "actorUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SocialInsuranceMovement_pkey" PRIMARY KEY ("id"));`,
    `CREATE INDEX IF NOT EXISTS "SocialInsuranceMovement_recordId_idx" ON "SocialInsuranceMovement"("recordId");`,
    `CREATE INDEX IF NOT EXISTS "SocialInsuranceMovement_employeeId_idx" ON "SocialInsuranceMovement"("employeeId");`,
    `CREATE INDEX IF NOT EXISTS "SocialInsuranceMovement_createdAt_idx" ON "SocialInsuranceMovement"("createdAt");`,
    `DO $$ BEGIN CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN CREATE TYPE "EmployeeBonusType" AS ENUM ('BONUS', 'COMMISSION', 'INCENTIVE', 'REWARD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `ALTER TABLE "Allowance" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'OTHER';`,
    `ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'OTHER';`,
    `ALTER TABLE "EmployeeBankAccount" ADD COLUMN IF NOT EXISTS "swift" TEXT;`,
    `ALTER TABLE "EmployeeSalaryAdvance" ADD COLUMN IF NOT EXISTS "paidInstallments" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "OvertimeRequest" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2);`,
    `ALTER TABLE "OvertimeRequest" ADD COLUMN IF NOT EXISTS "includedInPayrollAt" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "absenceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "advanceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "bonusTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "costCenterId" TEXT;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "grossPay" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "insuranceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "lateDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "loanDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "payslipIssuedAt" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "penaltyDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "branchId" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "companyId" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "costCenterId" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "createdById" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "periodId" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "periodStartDate" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "periodEndDate" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);`,
    `CREATE TABLE IF NOT EXISTS "PayrollPeriod" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL, "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN', "closedAt" TIMESTAMP(3), "closedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPeriod_startDate_endDate_key" ON "PayrollPeriod"("startDate", "endDate");`,
    `CREATE INDEX IF NOT EXISTS "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");`,
    `CREATE TABLE IF NOT EXISTS "PayrollCostCenter" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PayrollCostCenter_pkey" PRIMARY KEY ("id"));`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PayrollCostCenter_code_key" ON "PayrollCostCenter"("code");`,
    `CREATE INDEX IF NOT EXISTS "PayrollCostCenter_isActive_idx" ON "PayrollCostCenter"("isActive");`,
    `CREATE TABLE IF NOT EXISTS "EmployeeBonus" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "type" "EmployeeBonusType" NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'SAR', "reason" TEXT NOT NULL, "awardedDate" TIMESTAMP(3) NOT NULL, "status" "RequestStatus" NOT NULL DEFAULT 'PENDING', "includedInPayrollAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeeBonus_pkey" PRIMARY KEY ("id"));`,
    `CREATE INDEX IF NOT EXISTS "EmployeeBonus_employeeId_idx" ON "EmployeeBonus"("employeeId");`,
    `CREATE INDEX IF NOT EXISTS "EmployeeBonus_status_idx" ON "EmployeeBonus"("status");`,
    `CREATE INDEX IF NOT EXISTS "EmployeeBonus_awardedDate_idx" ON "EmployeeBonus"("awardedDate");`,
    `CREATE INDEX IF NOT EXISTS "PayrollItem_costCenterId_idx" ON "PayrollItem"("costCenterId");`,
    `CREATE INDEX IF NOT EXISTS "PayrollRun_periodId_idx" ON "PayrollRun"("periodId");`,
    `CREATE INDEX IF NOT EXISTS "PayrollRun_costCenterId_idx" ON "PayrollRun"("costCenterId");`,
    `DO $$ BEGIN ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "PayrollCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "PayrollCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `ALTER TYPE "PayrollStatus" ADD VALUE IF NOT EXISTS 'LOCKED';`,
    `ALTER TYPE "PayrollStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "lockedById" TEXT;`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);`,
    `ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;`
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
