-- Payroll module expansion: adds PayrollPeriod (formal open/processing/closed
-- period tracking), PayrollCostCenter (accounting dimension), EmployeeBonus
-- (bonus/commission/incentive/reward, unified via `type`), and extends the
-- existing PayrollRun/PayrollItem/Allowance/Deduction/EmployeeSalaryAdvance/
-- EmployeeBankAccount models rather than duplicating them.
DO $$ BEGIN
  CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmployeeBonusType" AS ENUM ('BONUS', 'COMMISSION', 'INCENTIVE', 'REWARD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Allowance" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "EmployeeBankAccount" ADD COLUMN IF NOT EXISTS "swift" TEXT;
ALTER TABLE "EmployeeSalaryAdvance" ADD COLUMN IF NOT EXISTS "paidInstallments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OvertimeRequest" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2);
ALTER TABLE "OvertimeRequest" ADD COLUMN IF NOT EXISTS "includedInPayrollAt" TIMESTAMP(3);

ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "absenceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "advanceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "bonusTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "costCenterId" TEXT;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "grossPay" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "insuranceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "lateDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "loanDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "payslipIssuedAt" TIMESTAMP(3);
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "penaltyDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "costCenterId" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "periodId" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "periodStartDate" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "periodEndDate" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPeriod_startDate_endDate_key" ON "PayrollPeriod"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

CREATE TABLE IF NOT EXISTS "PayrollCostCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollCostCenter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollCostCenter_code_key" ON "PayrollCostCenter"("code");
CREATE INDEX IF NOT EXISTS "PayrollCostCenter_isActive_idx" ON "PayrollCostCenter"("isActive");

CREATE TABLE IF NOT EXISTS "EmployeeBonus" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeBonusType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "reason" TEXT NOT NULL,
    "awardedDate" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "includedInPayrollAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeBonus_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmployeeBonus_employeeId_idx" ON "EmployeeBonus"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeBonus_status_idx" ON "EmployeeBonus"("status");
CREATE INDEX IF NOT EXISTS "EmployeeBonus_awardedDate_idx" ON "EmployeeBonus"("awardedDate");

CREATE INDEX IF NOT EXISTS "PayrollItem_costCenterId_idx" ON "PayrollItem"("costCenterId");
CREATE INDEX IF NOT EXISTS "PayrollRun_periodId_idx" ON "PayrollRun"("periodId");
CREATE INDEX IF NOT EXISTS "PayrollRun_costCenterId_idx" ON "PayrollRun"("costCenterId");

DO $$ BEGIN
  ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "PayrollCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "PayrollCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
