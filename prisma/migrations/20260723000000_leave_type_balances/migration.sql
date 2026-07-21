-- Additive: gender/carry-over rules on LeaveType, and a new per-employee,
-- per-leave-type, per-year balance table. Existing EmployeeLeaveBalance
-- (single aggregate) is untouched.
ALTER TABLE "LeaveType" ADD COLUMN IF NOT EXISTS "genderRestriction" TEXT;
ALTER TABLE "LeaveType" ADD COLUMN IF NOT EXISTS "carryOverLimit" INTEGER;

CREATE TABLE IF NOT EXISTS "EmployeeLeaveTypeBalance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "accrued" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "carriedOver" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeLeaveTypeBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLeaveTypeBalance_employeeId_leaveTypeId_year_key" ON "EmployeeLeaveTypeBalance"("employeeId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "EmployeeLeaveTypeBalance_employeeId_idx" ON "EmployeeLeaveTypeBalance"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeLeaveTypeBalance_leaveTypeId_idx" ON "EmployeeLeaveTypeBalance"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "EmployeeLeaveTypeBalance_year_idx" ON "EmployeeLeaveTypeBalance"("year");

DO $$ BEGIN
  ALTER TABLE "EmployeeLeaveTypeBalance" ADD CONSTRAINT "EmployeeLeaveTypeBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeLeaveTypeBalance" ADD CONSTRAINT "EmployeeLeaveTypeBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
