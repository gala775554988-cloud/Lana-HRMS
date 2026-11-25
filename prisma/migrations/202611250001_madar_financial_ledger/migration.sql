-- Additive only: preserve all existing employee, leave, loan and payroll records.
CREATE TABLE "EmployeeFinancialEntry" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "effectType" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "state" TEXT NOT NULL DEFAULT 'POSTED',
  "reversalOfId" TEXT,
  "payrollRunId" TEXT,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeFinancialEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeFinancialEntry_sourceType_sourceId_effectType_key"
  ON "EmployeeFinancialEntry"("sourceType", "sourceId", "effectType");
CREATE INDEX "EmployeeFinancialEntry_employeeId_occurredAt_idx"
  ON "EmployeeFinancialEntry"("employeeId", "occurredAt");
CREATE INDEX "EmployeeFinancialEntry_payrollRunId_idx" ON "EmployeeFinancialEntry"("payrollRunId");
CREATE INDEX "EmployeeFinancialEntry_reversalOfId_idx" ON "EmployeeFinancialEntry"("reversalOfId");
ALTER TABLE "EmployeeFinancialEntry" ADD CONSTRAINT "EmployeeFinancialEntry_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EmployeeRequestExecution" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "effectType" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "executedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeRequestExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeRequestExecution_sourceType_sourceId_effectType_key"
  ON "EmployeeRequestExecution"("sourceType", "sourceId", "effectType");
CREATE INDEX "EmployeeRequestExecution_employeeId_createdAt_idx"
  ON "EmployeeRequestExecution"("employeeId", "createdAt");
CREATE INDEX "EmployeeRequestExecution_state_idx" ON "EmployeeRequestExecution"("state");
ALTER TABLE "EmployeeRequestExecution" ADD CONSTRAINT "EmployeeRequestExecution_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
