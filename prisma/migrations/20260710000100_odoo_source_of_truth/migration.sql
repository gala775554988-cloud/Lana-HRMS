-- Phase 3: Odoo Source of Truth - Add explicit odoo_*_id fields
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooId" INTEGER UNIQUE;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooWriteDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooCreateDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooActive" BOOLEAN;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooDepartmentId" INTEGER;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooJobId" INTEGER;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooCompanyId" INTEGER;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooParentId" INTEGER;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "odooId" INTEGER UNIQUE;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "odooWriteDate" TIMESTAMP(3);
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "odooActive" BOOLEAN;
ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "odooId" INTEGER UNIQUE;
ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "odooWriteDate" TIMESTAMP(3);
ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "odooDepartmentId" INTEGER;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "odooId" INTEGER UNIQUE;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "odooWriteDate" TIMESTAMP(3);
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "odooActive" BOOLEAN;
ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooId" INTEGER UNIQUE;
ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooEmployeeId" INTEGER;
ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooWriteDate" TIMESTAMP(3);
ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooState" TEXT;
CREATE INDEX IF NOT EXISTS "Employee_odooId_idx" ON "Employee"("odooId");
CREATE INDEX IF NOT EXISTS "Employee_odooWriteDate_idx" ON "Employee"("odooWriteDate");
CREATE INDEX IF NOT EXISTS "Employee_odooDepartmentId_idx" ON "Employee"("odooDepartmentId");
CREATE INDEX IF NOT EXISTS "Employee_odooJobId_idx" ON "Employee"("odooJobId");
CREATE INDEX IF NOT EXISTS "Employee_odooCompanyId_idx" ON "Employee"("odooCompanyId");
CREATE INDEX IF NOT EXISTS "Department_odooId_idx" ON "Department"("odooId");
CREATE INDEX IF NOT EXISTS "Position_odooId_idx" ON "Position"("odooId");
CREATE INDEX IF NOT EXISTS "Branch_odooId_idx" ON "Branch"("odooId");
CREATE INDEX IF NOT EXISTS "EmployeeContract_odooId_idx" ON "EmployeeContract"("odooId");
CREATE INDEX IF NOT EXISTS "EmployeeContract_odooEmployeeId_idx" ON "EmployeeContract"("odooEmployeeId");
CREATE TABLE IF NOT EXISTS "SalaryStructure" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "SalaryComponent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "structureId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amountType" TEXT NOT NULL,
  "amount" DECIMAL(12,2),
  "formula" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryComponent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SalaryComponent_structureId_idx" ON "SalaryComponent"("structureId");
CREATE UNIQUE INDEX IF NOT EXISTS "SalaryComponent_structureId_code_key" ON "SalaryComponent"("structureId", "code");
