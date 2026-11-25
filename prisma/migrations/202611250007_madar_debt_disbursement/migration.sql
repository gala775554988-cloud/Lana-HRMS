ALTER TABLE "Loan" ADD COLUMN "disbursementRequired" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "disbursedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeSalaryAdvance" ADD COLUMN "disbursementRequired" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "disbursedAt" TIMESTAMP(3);
CREATE TABLE "PayrollDebtDisbursement" ("id" TEXT NOT NULL,"sourceType" TEXT NOT NULL,"sourceId" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL,"reference" TEXT NOT NULL,"confirmedById" TEXT NOT NULL,"disbursedAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "PayrollDebtDisbursement_pkey" PRIMARY KEY ("id"),CONSTRAINT "PayrollDebtDisbursement_positive" CHECK ("amount">0));
CREATE UNIQUE INDEX "PayrollDebtDisbursement_reference_key" ON "PayrollDebtDisbursement"("reference");
CREATE UNIQUE INDEX "PayrollDebtDisbursement_sourceType_sourceId_key" ON "PayrollDebtDisbursement"("sourceType","sourceId");
CREATE INDEX "PayrollDebtDisbursement_employeeId_idx" ON "PayrollDebtDisbursement"("employeeId");
