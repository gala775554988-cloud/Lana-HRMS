CREATE TABLE "PayrollBudgetLimit" (
"id" TEXT NOT NULL,"periodId" TEXT NOT NULL,"costCenterId" TEXT NOT NULL,"currency" TEXT NOT NULL,
"ceiling" DECIMAL(18,2) NOT NULL,"enforce" BOOLEAN NOT NULL DEFAULT false,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "PayrollBudgetLimit_pkey" PRIMARY KEY ("id"),
CONSTRAINT "PayrollBudgetLimit_ceiling_check" CHECK ("ceiling">=0));
CREATE UNIQUE INDEX "PayrollBudgetLimit_periodId_costCenterId_currency_key" ON "PayrollBudgetLimit"("periodId","costCenterId","currency");
CREATE TABLE "PayrollSalaryBand" (
"id" TEXT NOT NULL,"positionId" TEXT NOT NULL,"currency" TEXT NOT NULL,
"minimum" DECIMAL(12,2) NOT NULL,"maximum" DECIMAL(12,2) NOT NULL,"enforce" BOOLEAN NOT NULL DEFAULT false,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "PayrollSalaryBand_pkey" PRIMARY KEY ("id"),
CONSTRAINT "PayrollSalaryBand_limits_check" CHECK ("minimum">=0 AND "maximum">="minimum"));
CREATE UNIQUE INDEX "PayrollSalaryBand_positionId_currency_key" ON "PayrollSalaryBand"("positionId","currency");
ALTER TABLE "PayrollBudgetLimit" ADD CONSTRAINT "PayrollBudgetLimit_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollBudgetLimit" ADD CONSTRAINT "PayrollBudgetLimit_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "PayrollCostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryBand" ADD CONSTRAINT "PayrollSalaryBand_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PayrollBudgetLimit_costCenterId_idx" ON "PayrollBudgetLimit"("costCenterId");
