CREATE TABLE IF NOT EXISTS "EmployeeBankAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "bank" TEXT NOT NULL,
  "iban" TEXT NOT NULL,
  "account" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeFamilyMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "relation" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nationalId" TEXT,
  "phone" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeQualification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "organization" TEXT,
  "field" TEXT,
  "fromDate" TIMESTAMP(3),
  "toDate" TIMESTAMP(3),
  "attachmentUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeExperience" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "organization" TEXT,
  "fromDate" TIMESTAMP(3),
  "toDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeSkill" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeLanguage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'BASIC',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeePermissionRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "requestDate" TIMESTAMP(3) NOT NULL,
  "fromTime" TEXT NOT NULL,
  "toTime" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_MANAGER',
  "managerApprovedAt" TIMESTAMP(3),
  "hrApprovedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "workflow" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeePortalTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeePortalTaskComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeePortalTaskAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeChatThread" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL,
  "subject" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmployeeChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "senderUserId" TEXT,
  "body" TEXT,
  "fileName" TEXT,
  "fileUrl" TEXT,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EmployeeBankAccount_employeeId_idx" ON "EmployeeBankAccount"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeFamilyMember_employeeId_idx" ON "EmployeeFamilyMember"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeQualification_employeeId_idx" ON "EmployeeQualification"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeExperience_employeeId_idx" ON "EmployeeExperience"("employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSkill_employeeId_name_key" ON "EmployeeSkill"("employeeId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLanguage_employeeId_name_key" ON "EmployeeLanguage"("employeeId", "name");
CREATE INDEX IF NOT EXISTS "EmployeePermissionRequest_employeeId_idx" ON "EmployeePermissionRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeePermissionRequest_status_idx" ON "EmployeePermissionRequest"("status");
CREATE INDEX IF NOT EXISTS "EmployeePortalTask_employeeId_idx" ON "EmployeePortalTask"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeePortalTask_status_idx" ON "EmployeePortalTask"("status");
CREATE INDEX IF NOT EXISTS "EmployeePortalTaskComment_taskId_idx" ON "EmployeePortalTaskComment"("taskId");
CREATE INDEX IF NOT EXISTS "EmployeePortalTaskAttachment_taskId_idx" ON "EmployeePortalTaskAttachment"("taskId");
CREATE INDEX IF NOT EXISTS "EmployeeChatThread_employeeId_idx" ON "EmployeeChatThread"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeChatMessage_threadId_idx" ON "EmployeeChatMessage"("threadId");

DO $$ BEGIN ALTER TABLE "EmployeeBankAccount" ADD CONSTRAINT "EmployeeBankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeFamilyMember" ADD CONSTRAINT "EmployeeFamilyMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeQualification" ADD CONSTRAINT "EmployeeQualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeExperience" ADD CONSTRAINT "EmployeeExperience_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeLanguage" ADD CONSTRAINT "EmployeeLanguage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeePermissionRequest" ADD CONSTRAINT "EmployeePermissionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeePortalTask" ADD CONSTRAINT "EmployeePortalTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeePortalTaskComment" ADD CONSTRAINT "EmployeePortalTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EmployeePortalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeePortalTaskAttachment" ADD CONSTRAINT "EmployeePortalTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EmployeePortalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeChatThread" ADD CONSTRAINT "EmployeeChatThread_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeChatMessage" ADD CONSTRAINT "EmployeeChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmployeeChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
