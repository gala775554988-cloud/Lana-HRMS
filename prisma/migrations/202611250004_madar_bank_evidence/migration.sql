CREATE TABLE "PayrollBankEvidence" (
 "id" TEXT NOT NULL, "payrollRunId" TEXT NOT NULL, "originalName" TEXT NOT NULL,
 "sha256" TEXT NOT NULL, "originalBytes" BYTEA NOT NULL, "extractSha256" TEXT NOT NULL,
 "result" JSONB NOT NULL, "uploadedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PayrollBankEvidence_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PayrollBankEvidence_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PayrollBankEvidence_sha256_key" ON "PayrollBankEvidence"("sha256");
CREATE INDEX "PayrollBankEvidence_payrollRunId_createdAt_idx" ON "PayrollBankEvidence"("payrollRunId","createdAt");
