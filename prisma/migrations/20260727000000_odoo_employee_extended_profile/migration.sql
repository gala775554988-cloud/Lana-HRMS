-- Odoo extended employee profile. Additive and safe for existing production data.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeEnglishName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "iqamahJobName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "workPhone" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mobilePhone" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "firstContractDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "workingStatus" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hrPresenceState" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isAbsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooTimezone" TEXT DEFAULT 'Asia/Riyadh';
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooTags" JSONB;

-- Normalized, non-bank payroll contract metadata from Odoo.
ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooStructureType" TEXT;
ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "salaryDetails" JSONB;
