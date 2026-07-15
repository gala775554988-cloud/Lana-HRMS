-- Dynamic Odoo sync: raw field snapshots + Odoo-origin traceability (documents, payroll lines)
-- No bank/IBAN data is ever stored by these columns.

ALTER TABLE "Employee" ADD COLUMN "odooRawData" JSONB;
ALTER TABLE "Employee" ADD COLUMN "odooRawDataSyncedAt" TIMESTAMP(3);

ALTER TABLE "EmployeeDocument" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "EmployeeDocument" ADD COLUMN "odooAttachmentId" INTEGER;
CREATE UNIQUE INDEX "EmployeeDocument_odooAttachmentId_key" ON "EmployeeDocument"("odooAttachmentId");

ALTER TABLE "EmployeeContract" ADD COLUMN "odooRawData" JSONB;

ALTER TABLE "PayrollItem" ADD COLUMN "odooPayslipId" INTEGER;
ALTER TABLE "PayrollItem" ADD COLUMN "odooRawData" JSONB;
CREATE UNIQUE INDEX "PayrollItem_odooPayslipId_key" ON "PayrollItem"("odooPayslipId");

ALTER TABLE "Allowance" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Allowance" ADD COLUMN "odooPayslipLineId" INTEGER;
CREATE UNIQUE INDEX "Allowance_odooPayslipLineId_key" ON "Allowance"("odooPayslipLineId");

ALTER TABLE "Deduction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Deduction" ADD COLUMN "odooPayslipLineId" INTEGER;
CREATE UNIQUE INDEX "Deduction_odooPayslipLineId_key" ON "Deduction"("odooPayslipLineId");
