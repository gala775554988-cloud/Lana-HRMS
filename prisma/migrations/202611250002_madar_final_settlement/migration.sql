CREATE TABLE "EmployeeFinalSettlement" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "terminationDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "snapshot" JSONB NOT NULL,
  "netAmount" DECIMAL(18,2) NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeFinalSettlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeFinalSettlement_employeeId_terminationDate_key" ON "EmployeeFinalSettlement"("employeeId","terminationDate");
CREATE INDEX "EmployeeFinalSettlement_status_createdAt_idx" ON "EmployeeFinalSettlement"("status","createdAt");
ALTER TABLE "EmployeeFinalSettlement" ADD CONSTRAINT "EmployeeFinalSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
