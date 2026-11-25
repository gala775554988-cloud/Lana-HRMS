CREATE TABLE "PayrollLocalJournal" (
"id" TEXT NOT NULL,"payrollRunId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'ACCRUED',"lines" JSONB NOT NULL,"totals" JSONB NOT NULL,"createdById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"voidedAt" TIMESTAMP(3),
CONSTRAINT "PayrollLocalJournal_pkey" PRIMARY KEY ("id"),
CONSTRAINT "PayrollLocalJournal_status_check" CHECK ("status" IN ('ACCRUED','PAID','VOID')),
CONSTRAINT "PayrollLocalJournal_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "PayrollLocalJournal_payrollRunId_key" ON "PayrollLocalJournal"("payrollRunId");
