ALTER TABLE "EmployeeFinalSettlement" ADD COLUMN "paymentReference" TEXT, ADD COLUMN "paymentConfirmedById" TEXT, ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "EmployeeFinalSettlement_paymentReference_key" ON "EmployeeFinalSettlement"("paymentReference");
