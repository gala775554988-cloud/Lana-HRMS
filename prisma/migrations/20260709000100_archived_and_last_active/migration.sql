-- Add archived fields and lastActiveDate to Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastActiveDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastActiveSource" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

-- Add foreign key for manager self-relation
DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "Employee_email_idx" ON "Employee"("email");
CREATE INDEX IF NOT EXISTS "Employee_employeeNumber_idx" ON "Employee"("employeeNumber");
CREATE INDEX IF NOT EXISTS "Employee_lastActiveDate_idx" ON "Employee"("lastActiveDate");
CREATE INDEX IF NOT EXISTS "Employee_archivedAt_idx" ON "Employee"("archivedAt");
CREATE INDEX IF NOT EXISTS "Employee_managerId_idx" ON "Employee"("managerId");
CREATE INDEX IF NOT EXISTS "Employee_hireDate_idx" ON "Employee"("hireDate");
CREATE INDEX IF NOT EXISTS "Employee_createdAt_idx" ON "Employee"("createdAt");
CREATE INDEX IF NOT EXISTS "Employee_status_departmentId_idx" ON "Employee"("status", "departmentId");
CREATE INDEX IF NOT EXISTS "Employee_status_branchId_idx" ON "Employee"("status", "branchId");
CREATE INDEX IF NOT EXISTS "Employee_phone_idx" ON "Employee"("phone");
