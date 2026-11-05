-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "odooLoanId" INTEGER,
ADD COLUMN     "odooLoanModel" TEXT,
ADD COLUMN     "odooSource" TEXT,
ADD COLUMN     "odooWriteDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OdooMigrationJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "connectionId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "phase" TEXT NOT NULL DEFAULT 'EMPLOYEES',
    "config" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "upperId" INTEGER,
    "month" TEXT,
    "page" INTEGER NOT NULL DEFAULT 0,
    "lastWriteDate" TEXT,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "phaseProcessed" INTEGER NOT NULL DEFAULT 0,
    "phaseTotal" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "OdooMigrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdooMigrationError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdooMigrationError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdooSourceRecord" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "localId" TEXT,
    "writeDate" TEXT,
    "checksum" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdooSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdooLoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "remotePaid" BOOLEAN NOT NULL,
    "localPaidAt" TIMESTAMP(3),
    "raw" JSONB NOT NULL,

    CONSTRAINT "OdooLoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalPayrollRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "companyOdooId" INTEGER NOT NULL,
    "externalRunId" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalPayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalPayslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "odooPayslipId" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "basic" DECIMAL(20,6) NOT NULL,
    "gross" DECIMAL(20,6) NOT NULL,
    "deductions" DECIMAL(20,6) NOT NULL,
    "net" DECIMAL(20,6) NOT NULL,
    "moveId" INTEGER,
    "raw" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalPayslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalPayslipLine" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "rate" DECIMAL(20,6) NOT NULL,
    "total" DECIMAL(20,6) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "HistoricalPayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OdooMigrationJob_source_status_idx" ON "OdooMigrationJob"("source", "status");

-- CreateIndex
CREATE INDEX "OdooMigrationError_jobId_status_idx" ON "OdooMigrationError"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OdooMigrationError_jobId_entity_externalId_key" ON "OdooMigrationError"("jobId", "entity", "externalId");

-- CreateIndex
CREATE INDEX "OdooSourceRecord_source_entity_status_idx" ON "OdooSourceRecord"("source", "entity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OdooSourceRecord_source_entity_externalId_key" ON "OdooSourceRecord"("source", "entity", "externalId");

-- CreateIndex
CREATE INDEX "OdooLoanInstallment_loanId_dueDate_remotePaid_idx" ON "OdooLoanInstallment"("loanId", "dueDate", "remotePaid");

-- CreateIndex
CREATE UNIQUE INDEX "OdooLoanInstallment_loanId_externalId_key" ON "OdooLoanInstallment"("loanId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPayrollRun_source_period_companyOdooId_externalRu_key" ON "HistoricalPayrollRun"("source", "period", "companyOdooId", "externalRunId");

-- CreateIndex
CREATE INDEX "HistoricalPayslip_employeeId_fromDate_idx" ON "HistoricalPayslip"("employeeId", "fromDate");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPayslip_source_odooPayslipId_key" ON "HistoricalPayslip"("source", "odooPayslipId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPayslipLine_payslipId_externalId_key" ON "HistoricalPayslipLine"("payslipId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_odooSource_odooLoanModel_odooLoanId_key" ON "Loan"("odooSource", "odooLoanModel", "odooLoanId");

-- AddForeignKey
ALTER TABLE "OdooMigrationError" ADD CONSTRAINT "OdooMigrationError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OdooMigrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdooLoanInstallment" ADD CONSTRAINT "OdooLoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalPayslip" ADD CONSTRAINT "HistoricalPayslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HistoricalPayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalPayslipLine" ADD CONSTRAINT "HistoricalPayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "HistoricalPayslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One durable active operation per upstream source, including paused operations.
CREATE UNIQUE INDEX "OdooMigrationJob_active_source_key" ON "OdooMigrationJob"("source") WHERE "status" IN ('PENDING','RUNNING','PAUSED');
ALTER TABLE "OdooLoanInstallment" ADD CONSTRAINT "OdooLoanInstallment_positive_amount" CHECK ("amount" > 0);
