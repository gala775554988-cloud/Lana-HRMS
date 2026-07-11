CREATE TABLE IF NOT EXISTS "EmployeeSalaryAdvance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "installments" INTEGER NOT NULL DEFAULT 1,
  "monthlyDeduction" DECIMAL(12,2) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_MANAGER',
  "managerStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "hrStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "financeStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "managerComment" TEXT,
  "hrComment" TEXT,
  "financeComment" TEXT,
  "attachments" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EmployeeComplaint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'Medium',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "assignedTo" TEXT,
  "resolution" TEXT,
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EmployeeSalaryAdvance_employeeId_idx" ON "EmployeeSalaryAdvance"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeSalaryAdvance_status_idx" ON "EmployeeSalaryAdvance"("status");
CREATE INDEX IF NOT EXISTS "EmployeeSalaryAdvance_createdAt_idx" ON "EmployeeSalaryAdvance"("createdAt");
CREATE INDEX IF NOT EXISTS "EmployeeComplaint_employeeId_idx" ON "EmployeeComplaint"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeComplaint_type_idx" ON "EmployeeComplaint"("type");
CREATE INDEX IF NOT EXISTS "EmployeeComplaint_category_idx" ON "EmployeeComplaint"("category");
CREATE INDEX IF NOT EXISTS "EmployeeComplaint_status_idx" ON "EmployeeComplaint"("status");
CREATE INDEX IF NOT EXISTS "EmployeeComplaint_priority_idx" ON "EmployeeComplaint"("priority");
CREATE INDEX IF NOT EXISTS "EmployeeComplaint_createdAt_idx" ON "EmployeeComplaint"("createdAt");

DO $$ BEGIN ALTER TABLE "EmployeeSalaryAdvance" ADD CONSTRAINT "EmployeeSalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EmployeeComplaint" ADD CONSTRAINT "EmployeeComplaint_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
